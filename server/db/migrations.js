import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 从 Python 版本数据库迁移到新版本
 * @param {string} pythonDbPath - Python 版本数据库路径
 */
export const migrateFromPython = (pythonDbPath) => {
  console.log('🔄 Starting migration from Python database...');

  if (!fs.existsSync(pythonDbPath)) {
    throw new Error(`Python database not found: ${pythonDbPath}`);
  }

  const oldDb = new Database(pythonDbPath, { readonly: true });
  const newDbPath = path.join(__dirname, '../../database/qsl_manager.db');
  const newDb = new Database(newDbPath);

  try {
    // 1. 检查旧数据库结构
    const tables = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('📋 Found tables:', tables.map(t => t.name).join(', '));

    // 2. 迁移 callsigns 表
    console.log('📝 Migrating callsigns...');
    const callsigns = oldDb.prepare('SELECT * FROM callsigns').all();
    const insertCallsign = newDb.prepare('INSERT OR IGNORE INTO callsigns (callsign) VALUES (?)');
    callsigns.forEach(row => insertCallsign.run(row.callsign));
    console.log(`✅ Migrated ${callsigns.length} callsigns`);

    // 3. 迁移 logs 表
    console.log('📝 Migrating logs...');
    const logs = oldDb.prepare('SELECT * FROM logs').all();
    const insertLog = newDb.prepare(`
      INSERT INTO logs (
        id, sort_id, my_callsign, station_callsign, qso_date, time_on,
        band, band_rx, freq, freq_rx, mode, submode, rst_sent, rst_rcvd,
        comment, adif_blob, qsl_sent, qsl_rcvd, qsl_sent_date, qsl_rcvd_date,
        sat_name, prop_mode
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    logs.forEach(log => {
      insertLog.run(
        log.id,
        log.sort_id || log.id,
        log.my_callsign,
        log.station_callsign,
        log.qso_date,
        log.time_on,
        log.band,
        log.band_rx,
        log.freq,
        log.freq_rx,
        log.mode,
        log.submode,
        log.rst_sent,
        log.rst_rcvd,
        log.comment,
        log.adif_blob,
        log.qsl_sent || 'N',
        log.qsl_rcvd || 'N',
        log.qsl_sent_date,
        log.qsl_rcvd_date,
        log.sat_name,
        log.prop_mode
      );
    });
    console.log(`✅ Migrated ${logs.length} logs`);

    // 4. 迁移 qsl_cards 表（状态转换）
    console.log('📝 Migrating QSL cards...');
    const cards = oldDb.prepare('SELECT * FROM qsl_cards').all();
    const insertCard = newDb.prepare(`
      INSERT INTO qsl_cards (qsl_id, direction, status, location, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    cards.forEach(card => {
      // 状态转换逻辑：
      // - 如果关联的日志有 qsl_sent_date 或 qsl_rcvd_date，则为 in_stock/out_stock
      // - 否则为 pending
      const linkedLogs = oldDb.prepare(`
        SELECT l.qsl_sent_date, l.qsl_rcvd_date
        FROM logs l
        JOIN qsl_log_link ql ON l.id = ql.log_id
        WHERE ql.qsl_id = ?
      `).all(card.qsl_id);

      let status = 'pending';
      if (linkedLogs.length > 0) {
        const firstLog = linkedLogs[0];
        if (card.direction === 'TC' && firstLog.qsl_sent_date) {
          status = 'out_stock';
        } else if (card.direction === 'RC' && firstLog.qsl_rcvd_date) {
          status = 'in_stock';
        }
      }

      insertCard.run(
        card.qsl_id,
        card.direction,
        status,
        card.location,
        card.created_at
      );
    });
    console.log(`✅ Migrated ${cards.length} QSL cards`);

    // 5. 迁移 qsl_log_link 表
    console.log('📝 Migrating QSL-Log links...');
    const links = oldDb.prepare('SELECT * FROM qsl_log_link').all();
    const insertLink = newDb.prepare('INSERT INTO qsl_log_link (qsl_id, log_id) VALUES (?, ?)');
    links.forEach(link => insertLink.run(link.qsl_id, link.log_id));
    console.log(`✅ Migrated ${links.length} links`);

    console.log('🎉 Migration completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Callsigns: ${callsigns.length}`);
    console.log(`   - Logs: ${logs.length}`);
    console.log(`   - QSL Cards: ${cards.length}`);
    console.log(`   - Links: ${links.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    oldDb.close();
    newDb.close();
  }
};

// CLI 执行
if (import.meta.url === `file://${process.argv[1]}`) {
  const pythonDbPath = process.argv[2] || path.join(__dirname, '../../database/qsl_manager_old.db');
  
  try {
    migrateFromPython(pythonDbPath);
  } catch (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  }
}
