import express from 'express';
import { db } from '../db/database.js';
import QSLIDGenerator from '../services/qslGenerator.js';
import dayjs from 'dayjs';

const router = express.Router();

// 内存中的打印队列（与print.js共享）
let printQueue = [];
let queueIdCounter = { value: 1 }; // 使用对象以便共享引用

// 添加到打印队列的辅助函数
const addToPrintQueue = (qslId, layout, logIds) => {
  // 获取日志数据用于打印
  const logs = db.prepare(`
    SELECT l.* FROM logs l
    JOIN qsl_log_link ll ON l.id = ll.log_id
    WHERE ll.qsl_id = ?
    ORDER BY l.qso_date, l.time_on
  `).all(qslId);

  const queueItem = {
    id: queueIdCounter.value++,
    type: 'qsl_label',
    qsl_id: qslId,
    layout: layout,
    log_ids: logIds,
    logs: logs, // 直接存储日志数据
    status: 'ready', // 数据已准备好，可直接打印
    created_at: new Date().toISOString()
  };
  
  printQueue.push(queueItem);
  console.log(`Added QSL ${qslId} to print queue with ${logs.length} logs, layout ${layout}`);
  return queueItem;
};

/**
 * 生成 QSL 卡片（分配卡号）
 * POST /api/qsl/generate
 * Body: { log_ids: [1, 2], direction: 'TC', mode: 'multi' }
 */
router.post('/generate', (req, res) => {
  try {
    const { log_ids, direction, mode = 'multi' } = req.body;

    if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid log_ids' });
    }

    if (!['RC', 'TC'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'Invalid direction' });
    }

    const generatedCards = [];
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    if (mode === 'single') {
      // 单卡模式：所有日志共用一个卡号
      const qslId = QSLIDGenerator.generate(direction);
      
      // 插入卡片
      db.prepare(`
        INSERT INTO qsl_cards (qsl_id, direction, status, created_at)
        VALUES (?, ?, 'pending', ?)
      `).run(qslId, direction, now);

      // 关联所有日志
      const linkStmt = db.prepare('INSERT INTO qsl_log_link (qsl_id, log_id) VALUES (?, ?)');
      log_ids.forEach(logId => linkStmt.run(qslId, logId));

      // 更新日志状态
      updateLogStatus(log_ids, direction);

      generatedCards.push({ qsl_id: qslId, log_ids });

    } else {
      // 多卡模式：每条日志一个卡号
      log_ids.forEach(logId => {
        const qslId = QSLIDGenerator.generate(direction);
        
        // 插入卡片
        db.prepare(`
          INSERT INTO qsl_cards (qsl_id, direction, status, created_at)
          VALUES (?, ?, 'pending', ?)
        `).run(qslId, direction, now);

        // 关联日志
        db.prepare('INSERT INTO qsl_log_link (qsl_id, log_id) VALUES (?, ?)').run(qslId, logId);

        // 更新日志状态
        updateLogStatus([logId], direction);

        generatedCards.push({ qsl_id: qslId, log_ids: [logId] });
      });
    }

    // 自动添加到打印队列
    const printQueueItems = [];
    for (const card of generatedCards) {
      const layout = direction === 'TC' ? 1 : 2; // TC使用Layout 1, RC使用Layout 2
      const queueItem = addToPrintQueue(card.qsl_id, layout, card.log_ids);
      printQueueItems.push(queueItem);
    }

    res.status(201).json({
      success: true,
      data: generatedCards,
      print_queue_items: printQueueItems,
      message: `Generated ${generatedCards.length} QSL card(s) and added to print queue`
    });
  } catch (error) {
    console.error('Generate QSL error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取日志关联的 QSL 卡片
 * GET /api/qsl/by-log/:log_id
 */
router.get('/by-log/:log_id', (req, res) => {
  try {
    const cards = db.prepare(`
      SELECT q.* FROM qsl_cards q
      JOIN qsl_log_link ql ON q.qsl_id = ql.qsl_id
      WHERE ql.log_id = ?
    `).all(req.params.log_id);

    res.json({ success: true, data: cards });
  } catch (error) {
    console.error('Get QSL by log error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取 QSL 卡片关联的日志
 * GET /api/qsl/:qsl_id/logs
 */
router.get('/:qsl_id/logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.* FROM logs l
      JOIN qsl_log_link ql ON l.id = ql.log_id
      WHERE ql.qsl_id = ?
    `).all(req.params.qsl_id);

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Get logs by QSL error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 查询 QSL 卡片（前缀匹配）
 * GET /api/qsl/search?prefix=24000001&status=pending,in_stock,out_stock
 */
router.get('/search', (req, res) => {
  try {
    const { prefix, status } = req.query;

    let query = 'SELECT * FROM qsl_cards';
    const conditions = [];
    const params = [];

    // 前缀搜索
    if (prefix && typeof prefix === 'string' && prefix.trim().length > 0) {
      conditions.push('UPPER(qsl_id) LIKE ?');
      params.push(`${prefix.trim().toUpperCase()}%`);
    }

    // 状态过滤
    if (status && typeof status === 'string') {
      const statusList = status.split(',').map(s => s.trim());
      const placeholders = statusList.map(() => '?').join(',');
      conditions.push(`status IN (${placeholders})`);
      params.push(...statusList);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const cards = db.prepare(query).all(...params);

    // 获取每个卡片关联的日志ID
    const cardsWithLogs = cards.map(card => {
      const logs = db.prepare(`
        SELECT log_id FROM qsl_log_link WHERE qsl_id = ?
      `).all(card.qsl_id);
      
      return {
        ...card,
        log_ids: logs.map(l => l.log_id)
      };
    });

    res.json({ success: true, data: cardsWithLogs });
  } catch (error) {
    console.error('Search QSL error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 扫码出入库（状态更新）
 * POST /api/qsl/scan
 * Body: { qsl_id: '24000001TC...' }
 */
router.post('/scan', (req, res) => {
  try {
    const { qsl_id } = req.body;

    if (!qsl_id) {
      return res.status(400).json({ success: false, error: 'QSL ID required' });
    }

    // 查询卡片信息
    const card = db.prepare('SELECT * FROM qsl_cards WHERE qsl_id = ?').get(qsl_id);

    if (!card) {
      return res.status(404).json({ success: false, error: 'QSL card not found' });
    }

    const currentDate = dayjs().format('YYYYMMDD');
    const direction = card.direction;

    // 确定更新字段
    const dateField = direction === 'TC' ? 'qsl_sent_date' : 'qsl_rcvd_date';
    const newStatus = direction === 'TC' ? 'out_stock' : 'in_stock';

    // 查询关联的日志和呼号信息
    const logs = db.prepare(`
      SELECT l.id, l.${dateField}, l.station_callsign, l.my_callsign
      FROM logs l
      JOIN qsl_log_link ql ON l.id = ql.log_id
      WHERE ql.qsl_id = ?
    `).all(qsl_id);

    if (logs.length === 0) {
      return res.status(404).json({ success: false, error: 'No associated logs found' });
    }

    // 获取呼号信息（使用第一条日志的呼号）
    const firstLog = logs[0];
    const callsign = firstLog.station_callsign; // 对方呼号
    const stationCallsign = firstLog.my_callsign; // 我方呼号

    // 检查是否已处理
    const firstLogDate = logs[0][dateField];
    if (firstLogDate === currentDate) {
      return res.json({
        success: true,
        message: `Already processed today (${currentDate})`,
        already_processed: true
      });
    }

    // 更新日志日期
    const logIds = logs.map(l => l.id);
    const placeholders = logIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE logs 
      SET ${dateField} = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(currentDate, ...logIds);

    // 更新卡片状态
    db.prepare(`
      UPDATE qsl_cards 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE qsl_id = ?
    `).run(newStatus, qsl_id);

    const actionText = direction === 'TC' ? '已出库' : '已入库';

    res.json({
      success: true,
      message: `Card ${actionText} (Date: ${currentDate})`,
      data: {
        qsl_id,
        direction,
        status: newStatus,
        date: currentDate,
        updated_logs: logIds.length,
        callsign: callsign, // 对方呼号
        station_callsign: stationCallsign, // 我方呼号
        log_count: logIds.length
      }
    });
  } catch (error) {
    console.error('Scan QSL error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 回收 QSL 卡号
 * DELETE /api/qsl/:qsl_id/log/:log_id
 */
router.delete('/:qsl_id/log/:log_id', (req, res) => {
  try {
    const { qsl_id, log_id } = req.params;

    // 获取卡片方向
    const card = db.prepare('SELECT direction FROM qsl_cards WHERE qsl_id = ?').get(qsl_id);
    
    if (!card) {
      return res.status(404).json({ success: false, error: 'QSL card not found' });
    }

    const statusField = card.direction === 'TC' ? 'qsl_sent' : 'qsl_rcvd';
    const dateField = card.direction === 'TC' ? 'qsl_sent_date' : 'qsl_rcvd_date';

    // 重置日志状态
    db.prepare(`
      UPDATE logs 
      SET ${statusField} = 'N', ${dateField} = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(log_id);

    // 删除关联
    db.prepare('DELETE FROM qsl_log_link WHERE qsl_id = ? AND log_id = ?').run(qsl_id, log_id);

    // 检查是否还有其他关联
    const remainingLinks = db.prepare('SELECT COUNT(*) as count FROM qsl_log_link WHERE qsl_id = ?').get(qsl_id);

    if (remainingLinks.count === 0) {
      // 删除卡片
      db.prepare('DELETE FROM qsl_cards WHERE qsl_id = ?').run(qsl_id);
    }

    res.json({
      success: true,
      message: 'QSL card recycled',
      card_deleted: remainingLinks.count === 0
    });
  } catch (error) {
    console.error('Recycle QSL error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取 QSL 卡片详情
 * GET /api/qsl/:qsl_id
 */
router.get('/:qsl_id', (req, res) => {
  try {
    const card = db.prepare('SELECT * FROM qsl_cards WHERE qsl_id = ?').get(req.params.qsl_id);

    if (!card) {
      return res.status(404).json({ success: false, error: 'QSL card not found' });
    }

    // 获取关联的日志
    const logs = db.prepare(`
      SELECT l.* FROM logs l
      JOIN qsl_log_link ql ON l.id = ql.log_id
      WHERE ql.qsl_id = ?
    `).all(req.params.qsl_id);

    res.json({
      success: true,
      data: {
        ...card,
        logs
      }
    });
  } catch (error) {
    console.error('Get QSL detail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 辅助函数 ==========

/**
 * 更新日志的 QSL 状态
 */
function updateLogStatus(logIds, direction) {
  const statusField = direction === 'TC' ? 'qsl_sent' : 'qsl_rcvd';
  const placeholders = logIds.map(() => '?').join(',');
  
  db.prepare(`
    UPDATE logs 
    SET ${statusField} = 'Y', updated_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `).run(...logIds);
}

export default router;

// 导出打印队列供其他模块使用
export { printQueue, queueIdCounter };
