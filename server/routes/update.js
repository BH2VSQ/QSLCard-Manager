import express from 'express';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
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
 * 执行 git pull（仅快进）。返回输出文本；失败抛出带明确信息的 Error。
 */
async function runGitPull() {
  if (!fs.existsSync(path.join(PROJECT_ROOT, '.git'))) {
    throw new Error('当前目录不是 Git 仓库（缺少 .git 目录），无法通过 git pull 更新');
  }
  try {
    await execFileAsync('git', ['--version'], { timeout: 10000, windowsHide: true });
  } catch {
    throw new Error('运行环境未安装 git，无法执行更新');
  }

  // 更新源以 config.json 里的 update_repo 为准，而不是本地 git 的默认远程。
  // 否则当本地 origin 指向备份库时，git pull 会拉到备份库的内容。
  const repoUrl = getRepoUrl();

  // 当前分支（游离 HEAD 时回退到 main）
  let branch = 'main';
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: PROJECT_ROOT,
      timeout: 10000,
      windowsHide: true,
    });
    const b = stdout.trim();
    if (b && b !== 'HEAD') branch = b;
  } catch {
    // 忽略，使用默认 main
  }

  // 用 execFile（不走 shell）+ 参数数组，避免 repoUrl 被注入 shell 命令
  const { stdout, stderr } = await execFileAsync(
    'git',
    ['pull', '--ff-only', repoUrl, branch],
    { cwd: PROJECT_ROOT, timeout: 120000, windowsHide: true }
  );
  return (stdout + stderr).trim();
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
      gitOutput = await runGitPull();
      steps.push({ step: 'git pull', ok: true, output: gitOutput });
    } catch (e) {
      gitOutput = e.message;
      return res.json({
        success: false,
        error: 'git pull 失败：' + e.message,
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

    // 3. 生产环境重新构建前端（dev 模式由 vite 热更新，无需构建）
    if (process.env.NODE_ENV === 'production') {
      let buildOutput = '';
      try {
        const { stdout, stderr } = await execAsync('npm run build', {
          cwd: PROJECT_ROOT,
          timeout: 300000,
          windowsHide: true,
        });
        buildOutput = (stdout + stderr).trim();
        steps.push({ step: 'npm run build', ok: true, output: buildOutput });
      } catch (e) {
        buildOutput = ((e.stdout || '') + (e.stderr || '') + e.message).trim();
        steps.push({ step: 'npm run build', ok: false, output: buildOutput });
      }
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
 * 重启服务：PM2 环境下用 pm2 重启整个应用；否则退出进程，交给上层守护
 * （1Panel / systemd / Docker restart 策略 / PM2 autorestart）重新拉起。
 */
function scheduleRestart() {
  setTimeout(() => {
    if (process.env.pm_id !== undefined) {
      // PM2 管理：优先用本地 pm2 二进制重启，失败则退出交给 PM2 autorestart
      const name = process.env.name || 'qsl-manager';
      const pm2Bin = path.join(
        PROJECT_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'pm2.cmd' : 'pm2'
      );
      const pm2Cmd = fs.existsSync(pm2Bin) ? pm2Bin : 'pm2';
      exec(`${JSON.stringify(pm2Cmd)} restart ${name}`, { windowsHide: true }, (err) => {
        if (err) process.exit(0);
      });
      return;
    }
    process.exit(0);
  }, 1500);
}

export default router;
