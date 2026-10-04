import crypto from 'crypto';
import { db } from '../db/database.js';

/**
 * QSL ID 生成器
 * 格式: YYNNNNNN[RC/TC]HHHHHHHHHHHHHHHH
 * - YY: 年份（2位）
 * - NNNNNN: 序号（6位，年度重置）
 * - RC/TC: 方向（收卡/发卡）
 * - H: 随机十六进制（16位）
 */
class QSLIDGenerator {
  /**
   * 获取下一个序号
   * @param {string} direction - 'RC' 或 'TC'
   * @returns {number}
   */
  static getNextSerial(direction) {
    const currentYear = new Date().getFullYear().toString().slice(-2);

    // 现有卡片中的最大序号
    const lastCard = db.prepare(`
      SELECT qsl_id FROM qsl_cards
      WHERE direction = ? AND qsl_id LIKE ?
      ORDER BY qsl_id DESC
      LIMIT 1
    `).get(direction, `${currentYear}%`);

    let maxSerial = 0;
    if (lastCard) {
      maxSerial = parseInt(String(lastCard.qsl_id).substring(2, 8), 10) || 0;
    }

    // 序号水印：历史已分配的最大序号（解绑/回收后不复用，留出空位）
    const counter = db.prepare(`
      SELECT last_serial FROM qsl_serial_counter
      WHERE year = ? AND direction = ?
    `).get(currentYear, direction);
    const watermark = counter ? (counter.last_serial || 0) : 0;

    const nextSerial = Math.max(maxSerial, watermark) + 1;

    // 更新水印
    db.prepare(`
      INSERT OR REPLACE INTO qsl_serial_counter (year, direction, last_serial)
      VALUES (?, ?, ?)
    `).run(currentYear, direction, nextSerial);

    return nextSerial;
  }

  /**
   * 生成 QSL ID
   * @param {string} direction - 'RC' 或 'TC'
   * @returns {string}
   */
  static generate(direction) {
    if (!['RC', 'TC'].includes(direction)) {
      throw new Error('Direction must be "RC" or "TC"');
    }

    const year = new Date().getFullYear().toString().slice(-2);
    const serial = this.getNextSerial(direction);
    const serialStr = serial.toString().padStart(6, '0');
    const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase();

    return `${year}${serialStr}${direction}${randomHex}`;
  }

  /**
   * 验证 QSL ID 格式
   * @param {string} qslId
   * @returns {boolean}
   */
  static validate(qslId) {
    if (!qslId || typeof qslId !== 'string') return false;
    
    // 格式: 2位年份 + 6位序号 + 2位方向 + 16位十六进制
    const pattern = /^[0-9]{2}[0-9]{6}(RC|TC)[0-9A-F]{16}$/;
    return pattern.test(qslId);
  }

  /**
   * 解析 QSL ID
   * @param {string} qslId
   * @returns {object|null}
   */
  static parse(qslId) {
    if (!this.validate(qslId)) return null;

    return {
      year: qslId.substring(0, 2),
      serial: parseInt(qslId.substring(2, 8), 10),
      direction: qslId.substring(8, 10),
      random: qslId.substring(10)
    };
  }
}

export default QSLIDGenerator;
