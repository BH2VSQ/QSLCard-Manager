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
    
    // 查询当前年份最新的卡号
    const lastCard = db.prepare(`
      SELECT qsl_id FROM qsl_cards
      WHERE direction = ? AND qsl_id LIKE ?
      ORDER BY created_at DESC, qsl_id DESC
      LIMIT 1
    `).get(direction, `${currentYear}%`);

    if (!lastCard) {
      return 1; // 新年度第一张卡
    }

    const lastId = lastCard.qsl_id;
    const lastYear = lastId.substring(0, 2);
    
    // 如果年份不同，重置序号
    if (lastYear !== currentYear) {
      return 1;
    }

    // 提取序号并加1
    const lastSerial = parseInt(lastId.substring(2, 8), 10);
    return lastSerial + 1;
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
