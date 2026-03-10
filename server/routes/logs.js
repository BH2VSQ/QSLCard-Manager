import express from 'express';
import { db } from '../db/database.js';
import { freqToBand } from '../utils/freqBand.js';
import dayjs from 'dayjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseADIF, generateADIF } from '../utils/adifParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置文件上传
const upload = multer({ 
  dest: 'temp/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.adi' || ext === '.adif') {
      cb(null, true);
    } else {
      cb(new Error('Only .adi and .adif files are allowed'));
    }
  }
});

const router = express.Router();

/**
 * 获取日志列表（支持过滤和分页）
 * GET /api/logs?my_callsign=&station_callsign=&mode=&band=&qsl_id=&page=1&limit=50
 */
router.get('/', (req, res) => {
  try {
    const {
      my_callsign,
      station_callsign,
      mode,
      band,
      qsl_id,
      page = 1,
      limit = 50
    } = req.query;

    const conditions = [];
    const whereParams = [];
    let needsJoin = false;

    // QSL ID 过滤（需要 JOIN）
    if (qsl_id && qsl_id.trim()) {
      needsJoin = true;
      conditions.push('UPPER(q.qsl_id) LIKE ?');
      whereParams.push(`${qsl_id.trim().toUpperCase()}%`);
    }

    // 其他过滤条件
    if (my_callsign && my_callsign.trim()) {
      conditions.push('l.my_callsign LIKE ?');
      whereParams.push(`%${my_callsign.trim()}%`);
    }

    if (station_callsign && station_callsign.trim()) {
      conditions.push('l.station_callsign LIKE ?');
      whereParams.push(`%${station_callsign.trim()}%`);
    }

    if (mode && mode.trim() && mode !== '全部模式') {
      conditions.push('l.mode = ?');
      whereParams.push(mode.trim());
    }

    if (band && band.trim()) {
      conditions.push('l.band = ?');
      whereParams.push(band.trim());
    }

    // 构建主查询
    let query = `
      SELECT DISTINCT 
        l.id, l.sort_id, l.my_callsign, l.station_callsign, 
        l.qso_date, l.time_on, l.band, l.band_rx, l.freq, l.freq_rx,
        l.mode, l.submode, l.rst_sent, l.rst_rcvd, l.comment,
        l.qsl_sent, l.qsl_rcvd, l.qsl_sent_date, l.qsl_rcvd_date,
        l.sat_name, l.prop_mode, l.created_at
      FROM logs l
    `;

    // 如果需要 JOIN
    if (needsJoin) {
      query += ` 
        JOIN qsl_log_link ql ON l.id = ql.log_id 
        JOIN qsl_cards q ON ql.qsl_id = q.qsl_id
      `;
    }

    // 添加 WHERE 子句
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // 排序
    query += ' ORDER BY l.sort_id DESC';

    // 分页
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    
    // 主查询参数：WHERE 参数 + LIMIT + OFFSET
    const queryParams = [...whereParams, parseInt(limit), parseInt(offset)];
    const logs = db.prepare(query).all(...queryParams);

    // 构建计数查询
    let countQuery = 'SELECT COUNT(DISTINCT l.id) as total FROM logs l';
    
    if (needsJoin) {
      countQuery += ` 
        JOIN qsl_log_link ql ON l.id = ql.log_id 
        JOIN qsl_cards q ON ql.qsl_id = q.qsl_id
      `;
    }
    
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // 计数查询参数：只有 WHERE 参数，没有 LIMIT 和 OFFSET
    const countResult = db.prepare(countQuery).get(...whereParams);
    const total = countResult ? countResult.total : 0;

    res.json({
      success: true,
      data: {
        logs,
        total
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get logs error:', error);
    console.error('Error details:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取单条日志详情
 * GET /api/logs/:id
 */
router.get('/:id', (req, res) => {
  try {
    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id);
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }

    // 获取关联的 QSL 卡片
    const cards = db.prepare(`
      SELECT q.* FROM qsl_cards q
      JOIN qsl_log_link ql ON q.qsl_id = ql.qsl_id
      WHERE ql.log_id = ?
    `).all(req.params.id);

    res.json({ success: true, data: { ...log, qsl_cards: cards } });
  } catch (error) {
    console.error('Get log error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 创建新日志
 * POST /api/logs
 */
router.post('/', (req, res) => {
  try {
    const logData = req.body;

    // 自动转换频率到波段
    if (logData.freq && !logData.band) {
      logData.band = freqToBand(logData.freq);
    }
    if (logData.freq_rx && !logData.band_rx) {
      logData.band_rx = freqToBand(logData.freq_rx);
    }

    // 检查重复（5分钟时间窗口）
    const existingId = checkDuplicate(logData);
    if (existingId) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate log entry',
        existing_id: existingId
      });
    }

    // 插入日志
    const adifBlob = JSON.stringify(logData);
    const stmt = db.prepare(`
      INSERT INTO logs (
        my_callsign, station_callsign, qso_date, time_on,
        band, band_rx, freq, freq_rx, mode, submode,
        rst_sent, rst_rcvd, comment, adif_blob,
        sat_name, prop_mode, qsl_sent_date, qsl_rcvd_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      logData.my_callsign,
      logData.station_callsign,
      logData.qso_date,
      logData.time_on,
      logData.band,
      logData.band_rx,
      logData.freq,
      logData.freq_rx,
      logData.mode,
      logData.submode,
      logData.rst_sent,
      logData.rst_rcvd,
      logData.comment,
      adifBlob,
      logData.sat_name,
      logData.prop_mode,
      logData.qsl_sent_date,
      logData.qsl_rcvd_date
    );

    const logId = result.lastInsertRowid;

    // 设置 sort_id
    db.prepare('UPDATE logs SET sort_id = ? WHERE id = ?').run(logId, logId);

    res.status(201).json({
      success: true,
      data: { id: logId, ...logData }
    });
  } catch (error) {
    console.error('Create log error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新日志
 * PUT /api/logs/:id
 */
router.put('/:id', (req, res) => {
  try {
    const logData = req.body;
    const logId = req.params.id;

    // 自动转换频率到波段
    if (logData.freq && !logData.band) {
      logData.band = freqToBand(logData.freq);
    }

    const adifBlob = JSON.stringify(logData);
    const stmt = db.prepare(`
      UPDATE logs SET
        station_callsign = ?, qso_date = ?, time_on = ?,
        band = ?, band_rx = ?, freq = ?, freq_rx = ?,
        mode = ?, submode = ?, rst_sent = ?, rst_rcvd = ?,
        comment = ?, adif_blob = ?, sat_name = ?, prop_mode = ?,
        qsl_sent_date = ?, qsl_rcvd_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(
      logData.station_callsign,
      logData.qso_date,
      logData.time_on,
      logData.band,
      logData.band_rx,
      logData.freq,
      logData.freq_rx,
      logData.mode,
      logData.submode,
      logData.rst_sent,
      logData.rst_rcvd,
      logData.comment,
      adifBlob,
      logData.sat_name,
      logData.prop_mode,
      logData.qsl_sent_date,
      logData.qsl_rcvd_date,
      logId
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }

    res.json({ success: true, data: { id: logId, ...logData } });
  } catch (error) {
    console.error('Update log error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除日志
 * DELETE /api/logs/:id
 */
router.delete('/:id', (req, res) => {
  try {
    // 先删除关联
    db.prepare('DELETE FROM qsl_log_link WHERE log_id = ?').run(req.params.id);
    
    // 删除日志
    const result = db.prepare('DELETE FROM logs WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }

    res.json({ success: true, message: 'Log deleted' });
  } catch (error) {
    console.error('Delete log error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量删除日志
 * DELETE /api/logs/batch
 */
router.delete('/batch/delete', (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid ids' });
    }

    const placeholders = ids.map(() => '?').join(',');
    
    // 删除关联
    db.prepare(`DELETE FROM qsl_log_link WHERE log_id IN (${placeholders})`).run(...ids);
    
    // 删除日志
    const result = db.prepare(`DELETE FROM logs WHERE id IN (${placeholders})`).run(...ids);

    res.json({
      success: true,
      message: `Deleted ${result.changes} logs`
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 按时间重排序
 * POST /api/logs/reorder
 */
router.post('/reorder', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT id FROM logs 
      ORDER BY qso_date, time_on
    `).all();

    const updateStmt = db.prepare('UPDATE logs SET sort_id = ? WHERE id = ?');
    
    logs.forEach((log, index) => {
      updateStmt.run(index + 1, log.id);
    });

    res.json({
      success: true,
      message: `Reordered ${logs.length} logs`
    });
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 检查并合并重复日志
 * POST /api/logs/deduplicate
 */
router.post('/deduplicate', (req, res) => {
  try {
    const duplicateSets = findAllDuplicates();
    let mergedCount = 0;

    duplicateSets.forEach(duplicateSet => {
      const logIds = Array.from(duplicateSet).sort((a, b) => a - b);
      const masterId = logIds[0];
      const masterLog = db.prepare('SELECT * FROM logs WHERE id = ?').get(masterId);

      for (let i = 1; i < logIds.length; i++) {
        const dupId = logIds[i];
        const dupLog = db.prepare('SELECT * FROM logs WHERE id = ?').get(dupId);

        // 合并数据
        const merged = { ...masterLog };
        let needsUpdate = false;

        Object.keys(dupLog).forEach(key => {
          if (!['id', 'adif_blob', 'created_at', 'updated_at'].includes(key)) {
            if (dupLog[key] && !merged[key]) {
              merged[key] = dupLog[key];
              needsUpdate = true;
            }
          }
        });

        // 合并备注
        if (dupLog.comment && dupLog.comment !== merged.comment) {
          merged.comment = `${merged.comment || ''} | MERGED: ${dupLog.comment}`.trim();
          needsUpdate = true;
        }

        if (needsUpdate) {
          db.prepare(`
            UPDATE logs SET comment = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(merged.comment, masterId);
        }

        // 删除重复日志
        db.prepare('DELETE FROM qsl_log_link WHERE log_id = ?').run(dupId);
        db.prepare('DELETE FROM logs WHERE id = ?').run(dupId);
      }

      mergedCount++;
    });

    res.json({
      success: true,
      message: `Merged ${mergedCount} duplicate sets`
    });
  } catch (error) {
    console.error('Deduplicate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 辅助函数 ==========

/**
 * 检查重复日志（5分钟时间窗口）
 */
function checkDuplicate(logData) {
  const potentialDups = db.prepare(`
    SELECT id, time_on FROM logs
    WHERE UPPER(station_callsign) = ? 
      AND qso_date = ?
      AND UPPER(band) = ?
      AND UPPER(mode) = ?
  `).all(
    logData.station_callsign.toUpperCase(),
    logData.qso_date,
    (logData.band || '').toUpperCase(),
    (logData.mode || '').toUpperCase()
  );

  if (potentialDups.length === 0) return null;

  try {
    const newTime = dayjs(`2000-01-01 ${logData.time_on.padStart(6, '0')}`, 'YYYY-MM-DD HHmmss');
    
    for (const dup of potentialDups) {
      const existingTime = dayjs(`2000-01-01 ${dup.time_on.padStart(6, '0')}`, 'YYYY-MM-DD HHmmss');
      const diffMinutes = Math.abs(newTime.diff(existingTime, 'minute'));
      
      if (diffMinutes <= 5) {
        return dup.id;
      }
    }
  } catch (error) {
    console.error('Time comparison error:', error);
  }

  return null;
}

/**
 * 查找所有重复日志
 */
function findAllDuplicates() {
  const candidateGroups = db.prepare(`
    SELECT station_callsign, qso_date, band, mode
    FROM logs
    GROUP BY UPPER(station_callsign), qso_date, UPPER(band), UPPER(mode)
    HAVING COUNT(id) > 1
  `).all();

  const duplicateSets = [];

  candidateGroups.forEach(group => {
    const logsInGroup = db.prepare(`
      SELECT id, time_on FROM logs
      WHERE UPPER(station_callsign) = ?
        AND qso_date = ?
        AND UPPER(band) = ?
        AND UPPER(mode) = ?
      ORDER BY time_on
    `).all(
      group.station_callsign.toUpperCase(),
      group.qso_date,
      (group.band || '').toUpperCase(),
      (group.mode || '').toUpperCase()
    );

    if (logsInGroup.length < 2) return;

    const visited = new Set();
    
    for (let i = 0; i < logsInGroup.length; i++) {
      if (visited.has(i)) continue;

      const currentSet = new Set([logsInGroup[i].id]);
      
      try {
        const timeI = dayjs(`2000-01-01 ${logsInGroup[i].time_on.padStart(6, '0')}`, 'YYYY-MM-DD HHmmss');

        for (let j = i + 1; j < logsInGroup.length; j++) {
          if (visited.has(j)) continue;

          const timeJ = dayjs(`2000-01-01 ${logsInGroup[j].time_on.padStart(6, '0')}`, 'YYYY-MM-DD HHmmss');
          const diffMinutes = Math.abs(timeJ.diff(timeI, 'minute'));

          if (diffMinutes <= 5) {
            currentSet.add(logsInGroup[j].id);
            visited.add(j);
          }
        }
      } catch (error) {
        console.error('Time comparison error:', error);
      }

      if (currentSet.size > 1) {
        duplicateSets.push(currentSet);
      }
    }
  });

  return duplicateSets;
}

export default router;


/**
 * 导入 ADIF
 * POST /api/logs/import
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // 读取文件
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    
    // 解析 ADIF
    const records = parseADIF(fileContent);
    
    if (records.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'No valid records found in ADIF file' });
    }

    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        // 检查重复（5分钟窗口）
        const isDuplicate = db.prepare(`
          SELECT id FROM logs 
          WHERE station_callsign = ? 
          AND qso_date = ? 
          AND ABS(CAST(time_on AS INTEGER) - CAST(? AS INTEGER)) <= 5
        `).get(record.call, record.qso_date, record.time_on);
        
        if (isDuplicate) {
          duplicateCount++;
          continue;
        }

        // 插入日志
        const result = db.prepare(`
          INSERT INTO logs (
            station_callsign, qso_date, time_on, freq, band, mode,
            rst_sent, rst_rcvd, my_callsign, tx_pwr, notes,
            sat_name, sat_mode, my_gridsquare,
            qsl_sent, qsl_rcvd
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.call || '',
          record.qso_date || '',
          record.time_on || '',
          record.freq || null,
          record.band || '',
          record.mode || '',
          record.rst_sent || '',
          record.rst_rcvd || '',
          record.station_callsign || '',
          record.tx_pwr || null,
          record.comment || '',
          record.sat_name || null,
          record.sat_mode || null,
          record.my_gridsquare || null,
          'N',
          'N'
        );

        if (result.changes > 0) {
          importedCount++;
        }
      } catch (error) {
        console.error('Import record error:', error);
        errorCount++;
      }
    }

    // 自动重排序
    try {
      const logs = db.prepare('SELECT id FROM logs ORDER BY qso_date, time_on').all();
      logs.forEach((log, index) => {
        db.prepare('UPDATE logs SET sort_id = ? WHERE id = ?').run(index + 1, log.id);
      });
    } catch (error) {
      console.error('Reorder after import error:', error);
    }

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        imported_count: importedCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        total_count: records.length
      },
      message: `成功导入 ${importedCount} 条记录，跳过 ${duplicateCount} 条重复记录${errorCount > 0 ? `，${errorCount} 条记录导入失败` : ''}`
    });
  } catch (error) {
    console.error('Import ADIF error:', error);
    
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 导出 ADIF
 * GET /api/logs/export?ids=1,2,3
 */
router.get('/export', (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ success: false, error: 'No IDs provided' });
    }

    const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (idArray.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid IDs provided' });
    }

    // 获取日志
    const placeholders = idArray.map(() => '?').join(',');
    const logs = db.prepare(`
      SELECT * FROM logs WHERE id IN (${placeholders})
      ORDER BY qso_date, time_on
    `).all(...idArray);

    if (logs.length === 0) {
      return res.status(404).json({ success: false, error: 'No logs found' });
    }

    // 生成 ADIF 内容
    const adifContent = generateADIF(logs, {
      programId: 'QSL Manager',
      programVersion: '2.0.0',
      adifVersion: '3.1.0'
    });

    // 设置响应头
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="qso_export_${Date.now()}.adi"`);
    res.send(adifContent);
  } catch (error) {
    console.error('Export ADIF error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
