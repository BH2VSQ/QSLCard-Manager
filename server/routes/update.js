import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../..');

const DEFAULT_REPO = 'https://github.com/BH2VSQ/QSLCard-Manager';

const router = express.Router();

/**
 * 读取当前版本（来自 package.json）
 */
function getCurrentVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch (e) {
    console.error('读取当前版本失败:', e.message);
    return '0.0.0';
  }
}

/**
 * 读取配置中的更新库地址
 */
function getRepoUrl() {
  try {
    const configPath = path.join(PROJECT_ROOT, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.update_repo && config.update_repo.trim()) {
        return config.update_repo.trim();
      }
    }
  } catch (e) {
    console.error('读取更新库地址失败:', e.message);
  }
  return DEFAULT_REPO;
}

/**
 * 解析 GitHub 仓库地址 -> { owner, repo }
 * 支持：https://github.com/owner/repo 、git@github.com:owner/repo.git 、owner/repo
 */
function parseRepoUrl(url) {
  const cleaned = String(url || '').trim().replace(/\.git$/i, '').replace(/\/$/, '');
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  const simple = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (simple) {
    return { owner: simple[1], repo: simple[2] };
  }
  return null;
}

/**
 * 归一化版本号（去掉 v 前缀）
 */
function normalizeVersion(v) {
  return String(v || '').trim().replace(/^v/i, '');
}

/**
 * 比较版本号：a > b 返回 1，a < b 返回 -1，相等返回 0
 */
function compareVersions(a, b) {
  const pa = normalizeVersion(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = normalizeVersion(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/**
 * 从 GitHub API 获取最新 release
 */
async function fetchLatestRelease(repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error('无效的仓库地址，请填写 github.com/owner/repo 格式');
  }
  const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases/latest`;
  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'QSL-Manager',
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 404) {
    return null; // 仓库没有 release
  }
  if (!res.ok) {
    throw new Error(`GitHub API 请求失败 (${res.status})`);
  }
  const data = await res.json();
  return {
    tag_name: data.tag_name || '',
    name: data.name || '',
    body: data.body || '',
    published_at: data.published_at || '',
    html_url: data.html_url || '',
  };
}

/**
 * 检查更新
 * GET /api/update/check
 */
router.get('/check', async (req, res) => {
  try {
    const repoUrl = getRepoUrl();
    const currentVersion = getCurrentVersion();

    let latest = null;
    let error = null;
    try {
      latest = await fetchLatestRelease(repoUrl);
    } catch (e) {
      error = e.message;
    }

    if (latest && latest.tag_name) {
      const latestVersion = normalizeVersion(latest.tag_name);
      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
      res.json({
        success: true,
        data: {
          repo_url: repoUrl,
          current_version: currentVersion,
          latest_version: latestVersion,
          tag_name: latest.tag_name,
          name: latest.name,
          release_notes: latest.body,
          published_at: latest.published_at,
          html_url: latest.html_url,
          has_update: hasUpdate,
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          repo_url: repoUrl,
          current_version: currentVersion,
          latest_version: null,
          tag_name: null,
          name: null,
          release_notes: null,
          published_at: null,
          html_url: null,
          has_update: false,
          error: error || '未找到任何 release 版本',
        },
      });
    }
  } catch (e) {
    console.error('检查更新失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * 执行更新
 * POST /api/update/apply
 */
router.post('/apply', async (req, res) => {
  try {
    const steps = [];

    // 1. git pull（仅快进，避免产生合并冲突）
    let gitOutput = '';
    try {
      const { stdout, stderr } = await execAsync('git pull --ff-only', {
        cwd: PROJECT_ROOT,
        timeout: 120000,
        windowsHide: true,
      });
      gitOutput = (stdout + stderr).trim();
      steps.push({ step: 'git pull', ok: true, output: gitOutput });
    } catch (e) {
      gitOutput = ((e.stdout || '') + (e.stderr || '') + e.message).trim();
      return res.json({
        success: false,
        error: 'git pull 失败，请确认本地仓库没有未提交改动、与远程未分叉，或检查网络',
        output: gitOutput,
      });
    }

    // 2. 安装依赖（若 package.json 有变化则更新依赖）
    let npmOutput = '';
    try {
      const { stdout, stderr } = await execAsync('npm install', {
        cwd: PROJECT_ROOT,
        timeout: 300000,
        windowsHide: true,
      });
      npmOutput = (stdout + stderr).trim();
      steps.push({ step: 'npm install', ok: true, output: npmOutput });
    } catch (e) {
      npmOutput = ((e.stdout || '') + (e.stderr || '') + e.message).trim();
      steps.push({ step: 'npm install', ok: false, output: npmOutput });
    }

    res.json({
      success: true,
      message: '更新完成，服务即将重启...',
      steps,
    });

    // 延迟重启，确保响应已发送给前端
    scheduleRestart();
  } catch (e) {
    console.error('执行更新失败:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * 重启服务（PM2 环境下重启整个应用，否则退出让父进程处理）
 */
function scheduleRestart() {
  setTimeout(() => {
    if (process.env.pm_id !== undefined) {
      exec('pm2 restart qsl-manager', { windowsHide: true }, (err) => {
        if (err) process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }, 1500);
}

export default router;
