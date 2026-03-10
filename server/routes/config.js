import express from 'express';
import { db } from '../db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { migrateFromPython } from '../db/python-migration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, '../../config.json');

// 配置文件上传
const upload = multer({
  dest: path.join(__dirname, '../../temp'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const router = express.Router();

/**
 * 获取配置
 * GET /api/config
 */
router.get('/', (req, res) => {
  try {
    const config = loadConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新配置
 * PUT /api/config
 */
router.put('/', (req, res) => {
  try {
    const currentConfig = loadConfig();
    const newConfig = { ...currentConfig, ...req.body };
    saveConfig(newConfig);
    
    res.json({ success: true, data: newConfig });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取呼号列表
 * GET /api/config/callsigns
 */
router.get('/callsigns', (req, res) => {
  try {
    const callsigns = db.prepare('SELECT callsign FROM callsigns WHERE callsign IS NOT NULL ORDER BY callsign').all();
    console.log('📋 获取呼号列表:', callsigns.length, '个呼号');
    res.json({ success: true, data: callsigns.map(c => c.callsign) });
  } catch (error) {
    console.error('Get callsigns error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 添加呼号
 * POST /api/config/callsigns
 */
router.post('/callsigns', (req, res) => {
  try {
    const { callsign } = req.body;

    if (!callsign || !callsign.trim()) {
      return res.status(400).json({ success: false, error: 'Callsign required' });
    }

    const upperCallsign = callsign.trim().toUpperCase();

    try {
      db.prepare('INSERT INTO callsigns (callsign) VALUES (?)').run(upperCallsign);
      res.status(201).json({ success: true, data: { callsign: upperCallsign } });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(409).json({ success: false, error: 'Callsign already exists' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Add callsign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除呼号
 * DELETE /api/config/callsigns/:callsign
 */
router.delete('/callsigns/:callsign', (req, res) => {
  try {
    // 解码URL参数
    const callsign = decodeURIComponent(req.params.callsign);
    console.log('🗑️ 尝试删除呼号:', callsign);
    console.log('  原始参数:', req.params.callsign);
    
    // 先检查呼号是否存在
    const exists = db.prepare('SELECT callsign FROM callsigns WHERE callsign = ?').get(callsign);
    console.log('  呼号是否存在:', exists);
    
    if (!exists) {
      console.log('  ❌ 呼号不存在');
      // 列出所有呼号用于调试
      const allCallsigns = db.prepare('SELECT callsign FROM callsigns').all();
      console.log('  数据库中的所有呼号:', allCallsigns);
      return res.status(404).json({ success: false, error: 'Callsign not found' });
    }
    
    // 执行删除
    const result = db.prepare('DELETE FROM callsigns WHERE callsign = ?').run(callsign);
    console.log('  删除结果:', result);

    if (result.changes === 0) {
      console.log('  ❌ 删除失败，没有行被修改');
      return res.status(404).json({ success: false, error: 'Callsign not found' });
    }

    // 如果删除的是主要呼号，清除配置
    const config = loadConfig();
    if (config.primary_callsign === callsign) {
      console.log('  清除主要呼号配置');
      config.primary_callsign = '';
      saveConfig(config);
    }

    console.log('  ✓ 呼号删除成功');
    res.json({ success: true, message: 'Callsign deleted' });
  } catch (error) {
    console.error('Delete callsign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 设置主要呼号
 * PUT /api/config/primary-callsign
 */
router.put('/primary-callsign', (req, res) => {
  try {
    const { callsign } = req.body;

    if (!callsign) {
      return res.status(400).json({ success: false, error: 'Callsign required' });
    }

    // 验证呼号是否存在
    const exists = db.prepare('SELECT 1 FROM callsigns WHERE callsign = ?').get(callsign);
    
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Callsign not found' });
    }

    const config = loadConfig();
    config.primary_callsign = callsign;
    saveConfig(config);

    res.json({ success: true, data: { primary_callsign: callsign } });
  } catch (error) {
    console.error('Set primary callsign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 重置所有数据（危险操作 - 完全初始化数据库）
 * POST /api/config/reset-qsl
 */
router.post('/reset-qsl', (req, res) => {
  try {
    const { password } = req.body;

    if (password !== 'admin') {
      return res.status(403).json({ success: false, error: 'Invalid password' });
    }

    console.log('🗑️ 开始重置数据库...');

    // 删除所有数据
    console.log('删除 qsl_log_link...');
    const linkResult = db.prepare('DELETE FROM qsl_log_link').run();
    console.log(`  删除了 ${linkResult.changes} 条关联记录`);
    
    console.log('删除 qsl_cards...');
    const cardResult = db.prepare('DELETE FROM qsl_cards').run();
    console.log(`  删除了 ${cardResult.changes} 条卡片记录`);
    
    console.log('删除 logs...');
    const logResult = db.prepare('DELETE FROM logs').run();
    console.log(`  删除了 ${logResult.changes} 条日志记录`);
    
    console.log('删除 callsigns...');
    const callsignResult = db.prepare('DELETE FROM callsigns').run();
    console.log(`  删除了 ${callsignResult.changes} 条呼号记录`);
    
    // 重置自增ID
    console.log('重置自增序列...');
    try {
      db.prepare('DELETE FROM sqlite_sequence WHERE name IN ("logs", "qsl_cards")').run();
    } catch (e) {
      console.log('  sqlite_sequence 可能不存在，跳过');
    }
    
    // 清除配置文件中的主要呼号
    console.log('清除配置文件...');
    const config = loadConfig();
    config.primary_callsign = '';
    saveConfig(config);
    
    console.log('✓ 数据库重置完成');

    // 验证删除结果
    const logCount = db.prepare('SELECT COUNT(*) as count FROM logs').get();
    const cardCount = db.prepare('SELECT COUNT(*) as count FROM qsl_cards').get();
    const linkCount = db.prepare('SELECT COUNT(*) as count FROM qsl_log_link').get();
    const callsignCount = db.prepare('SELECT COUNT(*) as count FROM callsigns').get();
    
    console.log(`验证结果 - logs: ${logCount.count}, cards: ${cardCount.count}, links: ${linkCount.count}, callsigns: ${callsignCount.count}`);

    res.json({ 
      success: true, 
      message: 'All data reset successfully',
      deleted: {
        logs: logResult.changes,
        cards: cardResult.changes,
        links: linkResult.changes,
        callsigns: callsignResult.changes
      },
      remaining: {
        logs: logCount.count,
        cards: cardCount.count,
        links: linkCount.count,
        callsigns: callsignCount.count
      }
    });
  } catch (error) {
    console.error('Reset all data error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 导入 Python 版本数据库
 * POST /api/config/import-python-db
 */
router.post('/import-python-db', upload.single('database'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传数据库文件' });
    }

    tempFilePath = req.file.path;
    console.log('📥 接收到数据库文件:', req.file.originalname);

    // 执行迁移
    await migrateFromPython(tempFilePath);

    res.json({ 
      success: true, 
      message: 'Python 数据库导入成功',
      filename: req.file.originalname
    });

  } catch (error) {
    console.error('Import Python database error:', error);
    res.status(500).json({ 
      success: false, 
      error: '导入失败: ' + error.message 
    });
  } finally {
    // 清理临时文件
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error('清理临时文件失败:', err);
      }
    }
  }
});

// ========== 辅助函数 ==========

function loadConfig() {
  const defaultConfig = {
    primary_callsign: '',
    theme: 'light',
    continuous_log: false,
    nfc_port: '',
    nfc_baudrate: 9600
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.error('Load config error:', error);
    return defaultConfig;
  }
}

function saveConfig(config) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Save config error:', error);
    throw error;
  }
}

export default router;
