import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * 获取仪表板统计数据
 * GET /api/stats/dashboard
 */
router.get('/dashboard', (req, res) => {
  try {
    // 总日志数
    const { total_logs } = db.prepare('SELECT COUNT(*) as total_logs FROM logs').get();

    // 已发卡片数
    const { sent_cards } = db.prepare(`
      SELECT COUNT(*) as sent_cards FROM qsl_cards WHERE direction = 'TC'
    `).get();

    // 已收卡片数
    const { received_cards } = db.prepare(`
      SELECT COUNT(*) as received_cards FROM qsl_cards WHERE direction = 'RC'
    `).get();

    // 待出库数
    const { pending_out } = db.prepare(`
      SELECT COUNT(*) as pending_out FROM qsl_cards 
      WHERE direction = 'TC' AND status = 'pending'
    `).get();

    // 待入库数
    const { pending_in } = db.prepare(`
      SELECT COUNT(*) as pending_in FROM qsl_cards 
      WHERE direction = 'RC' AND status = 'pending'
    `).get();

    // 已出库数
    const { out_stock } = db.prepare(`
      SELECT COUNT(*) as out_stock FROM qsl_cards 
      WHERE direction = 'TC' AND status = 'out_stock'
    `).get();

    // 已入库数
    const { in_stock } = db.prepare(`
      SELECT COUNT(*) as in_stock FROM qsl_cards 
      WHERE direction = 'RC' AND status = 'in_stock'
    `).get();

    res.json({
      success: true,
      data: {
        total_logs,
        sent_cards,
        received_cards,
        pending_out,
        pending_in,
        out_stock,
        in_stock
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取近期活动
 * GET /api/stats/recent-activity?limit=10
 */
router.get('/recent-activity', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // 先检查是否有数据
    const cardCount = db.prepare('SELECT COUNT(*) as count FROM qsl_cards').get();
    
    if (!cardCount || cardCount.count === 0) {
      // 如果没有数据，返回空数组
      return res.json({ success: true, data: [] });
    }

    const activities = db.prepare(`
      SELECT 
        q.qsl_id,
        q.direction,
        q.status,
        q.created_at,
        l.station_callsign,
        l.qso_date,
        l.mode
      FROM qsl_cards q
      JOIN qsl_log_link ql ON q.qsl_id = ql.qsl_id
      JOIN logs l ON ql.log_id = l.id
      ORDER BY q.created_at DESC
      LIMIT ?
    `).all(limit);

    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取统计图表数据
 * GET /api/stats/charts
 */
router.get('/charts', (req, res) => {
  try {
    // 按模式统计
    const byMode = db.prepare(`
      SELECT mode, COUNT(*) as count
      FROM logs
      WHERE mode IS NOT NULL AND mode != ''
      GROUP BY mode
      ORDER BY count DESC
      LIMIT 10
    `).all();

    // 按波段统计
    const byBand = db.prepare(`
      SELECT band, COUNT(*) as count
      FROM logs
      WHERE band IS NOT NULL AND band != ''
      GROUP BY band
      ORDER BY count DESC
    `).all();

    // 按月份统计（最近12个月）
    const byMonth = db.prepare(`
      SELECT 
        substr(qso_date, 1, 6) as month,
        COUNT(*) as count
      FROM logs
      WHERE qso_date >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `).all();

    res.json({
      success: true,
      data: {
        by_mode: byMode,
        by_band: byBand,
        by_month: byMonth
      }
    });
  } catch (error) {
    console.error('Get charts data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
