import express from 'express';
import { addressDb } from '../db/database.js';

const router = express.Router();

/**
 * 获取地址列表
 * GET /api/address?search=&page=1&limit=50
 */
router.get('/', (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM addresses';
    const params = [];

    if (search && search.trim()) {
      query += ' WHERE callsign LIKE ? OR name LIKE ?';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY callsign';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const addresses = addressDb.prepare(query).all(...params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM addresses';
    if (search && search.trim()) {
      countQuery += ' WHERE callsign LIKE ? OR name LIKE ?';
    }
    const { total } = addressDb.prepare(countQuery).get(...params.slice(0, -2));

    res.json({
      success: true,
      data: addresses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 根据呼号获取地址
 * GET /api/address/callsign/:callsign
 */
router.get('/callsign/:callsign', (req, res) => {
  try {
    const address = addressDb.prepare('SELECT * FROM addresses WHERE callsign = ?').get(req.params.callsign);
    
    if (!address) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }

    res.json({ success: true, data: address });
  } catch (error) {
    console.error('Get address by callsign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 创建/更新地址
 * POST /api/address
 */
router.post('/', (req, res) => {
  try {
    const { callsign, name, phone, postal_code, country, address } = req.body;

    if (!callsign || !callsign.trim()) {
      return res.status(400).json({ success: false, error: 'Callsign required' });
    }

    const upperCallsign = callsign.trim().toUpperCase();

    // 检查是否存在
    const existing = addressDb.prepare('SELECT callsign FROM addresses WHERE callsign = ?').get(upperCallsign);

    if (existing) {
      // 更新
      addressDb.prepare(`
        UPDATE addresses 
        SET name = ?, phone = ?, postal_code = ?, country = ?, address = ?, updated_at = CURRENT_TIMESTAMP
        WHERE callsign = ?
      `).run(name, phone, postal_code, country, address, upperCallsign);

      res.json({ success: true, message: 'Address updated', data: { callsign: upperCallsign } });
    } else {
      // 创建
      addressDb.prepare(`
        INSERT INTO addresses (callsign, name, phone, postal_code, country, address)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(upperCallsign, name, phone, postal_code, country, address);

      res.status(201).json({ success: true, message: 'Address created', data: { callsign: upperCallsign } });
    }
  } catch (error) {
    console.error('Save address error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除地址
 * DELETE /api/address/:callsign
 */
router.delete('/:callsign', (req, res) => {
  try {
    const result = addressDb.prepare('DELETE FROM addresses WHERE callsign = ?').run(req.params.callsign);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }

    res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取发件人默认地址
 * GET /api/address/sender/default
 */
router.get('/sender/default', (req, res) => {
  try {
    const sender = addressDb.prepare('SELECT * FROM sender_default WHERE id = 1').get();
    res.json({ success: true, data: sender || {} });
  } catch (error) {
    console.error('Get sender default error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新发件人默认地址
 * PUT /api/address/sender/default
 */
router.put('/sender/default', (req, res) => {
  try {
    const { name, phone, postal_code, country, address } = req.body;
    console.log('💾 更新发件人默认地址:', { name, phone, postal_code, country, address });

    // 处理 undefined 值，转换为 null
    const cleanData = {
      name: name || null,
      phone: phone || null,
      postal_code: postal_code || null,
      country: country || null,
      address: address || null
    };
    console.log('  清理后的数据:', cleanData);

    // 检查是否存在
    let existing;
    try {
      existing = addressDb.prepare('SELECT id FROM sender_default WHERE id = 1').get();
      console.log('  现有记录:', existing);
    } catch (selectError) {
      console.log('  表可能不存在，尝试重新创建...');
      // 重新创建表
      addressDb.prepare(`
        CREATE TABLE IF NOT EXISTS sender_default (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          name TEXT,
          phone TEXT,
          address TEXT,
          postal_code TEXT,
          country TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      existing = null;
    }

    if (existing) {
      console.log('  执行更新操作...');
      const result = addressDb.prepare(`
        UPDATE sender_default 
        SET name = ?, phone = ?, postal_code = ?, country = ?, address = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(cleanData.name, cleanData.phone, cleanData.postal_code, cleanData.country, cleanData.address);
      console.log('  更新结果:', result);
    } else {
      console.log('  执行插入操作...');
      const result = addressDb.prepare(`
        INSERT INTO sender_default (id, name, phone, postal_code, country, address)
        VALUES (1, ?, ?, ?, ?, ?)
      `).run(cleanData.name, cleanData.phone, cleanData.postal_code, cleanData.country, cleanData.address);
      console.log('  插入结果:', result);
    }

    console.log('  ✅ 发件人默认地址更新成功');
    res.json({ success: true, message: 'Sender default address updated' });
  } catch (error) {
    console.error('❌ Update sender default error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
