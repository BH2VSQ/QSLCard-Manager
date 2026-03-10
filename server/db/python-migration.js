import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 从 Python 版本数据库迁移到新版本
 * @param {string} pythonDbPath - Python 版本数据库路径
 */
export async function migrateFromPython(pythonDbPath) {
  console.log('🔄 开始从 Python 数据库迁移...');

  if (!fs.existsSync(pythonDbPath)) {
    throw new Error(`Python 数据库文件不存在: ${pythonDbPath}`);
  }

  try {
    // 初始化 sql.js
    const SQL = await initSqlJs();
    
    // 读取旧数据库文件
    const oldDbBuffer = fs.readFileSync(pythonDbPath);
    const oldDb = new SQL.Database(oldDbBuffer);

    // 1. 检查旧数据库结构
    const tables = oldDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0] ? tables[0].values.map(row => row[0]) : [];
    console.log('📋 发现表:', tableNames.join(', '));

    // 2. 迁移 callsigns 表（如果存在）
    if (tableNames.includes('callsigns')) {
      console.log('📝 迁移呼号...');
      const callsignsResult = oldDb.exec('SELECT callsign FROM callsigns');
      if (callsignsResult[0]) {
        const callsigns = callsignsResult[0].values;
        let count = 0;
        callsigns.forEach(row => {
          const callsign = row[0];
          if (callsign) {
            try {
              db.prepare('INSERT OR IGNORE INTO callsigns (callsign) VALUES (?)').run(callsign);
              count++;
            } catch (error) {
              console.warn(`跳过呼号 ${callsign}:`, error.message);
            }
          }
        });
        console.log(`✅ 迁移了 ${count} 个呼号`);
      }
    }

    // 3. 迁移 logs 表
    console.log('📝 迁移日志...');
    const logsResult = oldDb.exec('SELECT * FROM logs');
    if (logsResult[0]) {
      const columns = logsResult[0].columns;
      const logs = logsResult[0].values;
      
      let count = 0;
      logs.forEach(row => {
        const log = {};
        columns.forEach((col, idx) => {
          log[col] = row[idx];
        });

        try {
          db.prepare(`
            INSERT OR REPLACE INTO logs (
              id, sort_id, my_callsign, station_callsign, qso_date, time_on,
              band, band_rx, freq, freq_rx, mode, submode, rst_sent, rst_rcvd,
              comment, qsl_sent, qsl_rcvd, qsl_sent_date, qsl_rcvd_date,
              sat_name, prop_mode, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
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
            log.qsl_sent || 'N',
            log.qsl_rcvd || 'N',
            log.qsl_sent_date,
            log.qsl_rcvd_date,
            log.sat_name,
            log.prop_mode,
            log.created_at || new Date().toISOString(),
            log.updated_at || new Date().toISOString()
          );
          count++;
        } catch (error) {
          console.warn(`跳过日志 ${log.id}:`, error.message);
        }
      });
      console.log(`✅ 迁移了 ${count} 条日志`);
    }

    // 4. 迁移 qsl_cards 表（如果存在）
    if (tableNames.includes('qsl_cards')) {
      console.log('📝 迁移 QSL 卡片...');
      const cardsResult = oldDb.exec('SELECT * FROM qsl_cards');
      if (cardsResult[0]) {
        const columns = cardsResult[0].columns;
        const cards = cardsResult[0].values;
        
        let count = 0;
        cards.forEach(row => {
          const card = {};
          columns.forEach((col, idx) => {
            card[col] = row[idx];
          });

          // 状态转换逻辑：
          // - TC (发卡): 如果有 qsl_sent_date，则为 out_stock，否则为 pending
          // - RC (收卡): 如果有 qsl_rcvd_date，则为 in_stock，否则为 pending
          let status = 'pending';
          
          // 检查是否有关联的日志，并根据日志的QSL状态判定卡片状态
          if (tableNames.includes('qsl_log_link')) {
            try {
              const linkResult = oldDb.exec(`
                SELECT l.qsl_sent_date, l.qsl_rcvd_date, l.qsl_sent, l.qsl_rcvd
                FROM logs l
                JOIN qsl_log_link ql ON l.id = ql.log_id
                WHERE ql.qsl_id = '${card.qsl_id.replace(/'/g, "''")}'
                LIMIT 1
              `);
              
              if (linkResult[0] && linkResult[0].values.length > 0) {
                const [qsl_sent_date, qsl_rcvd_date, qsl_sent, qsl_rcvd] = linkResult[0].values[0];
                
                if (card.direction === 'TC') {
                  // 发卡：检查 qsl_sent_date 或 qsl_sent = 'Y'
                  if (qsl_sent_date || qsl_sent === 'Y') {
                    status = 'out_stock';
                  }
                } else if (card.direction === 'RC') {
                  // 收卡：检查 qsl_rcvd_date 或 qsl_rcvd = 'Y'
                  if (qsl_rcvd_date || qsl_rcvd === 'Y') {
                    status = 'in_stock';
                  }
                }
              }
            } catch (linkError) {
              console.warn(`检查卡片 ${card.qsl_id} 状态时出错:`, linkError.message);
            }
          }

          console.log(`  卡片 ${card.qsl_id} (${card.direction}) -> ${status}`);

          try {
            db.prepare(`
              INSERT OR REPLACE INTO qsl_cards (qsl_id, direction, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              card.qsl_id,
              card.direction,
              status,
              card.created_at || new Date().toISOString(),
              card.updated_at || new Date().toISOString()
            );
            count++;
          } catch (error) {
            console.warn(`跳过卡片 ${card.qsl_id}:`, error.message);
          }
        });
        console.log(`✅ 迁移了 ${count} 张 QSL 卡片`);
      }
    }

    // 5. 迁移 qsl_log_link 表（如果存在）
    if (tableNames.includes('qsl_log_link')) {
      console.log('📝 迁移 QSL-日志关联...');
      const linksResult = oldDb.exec('SELECT * FROM qsl_log_link');
      if (linksResult[0]) {
        const links = linksResult[0].values;
        let count = 0;
        links.forEach(row => {
          const [qsl_id, log_id] = row;
          try {
            db.prepare('INSERT OR IGNORE INTO qsl_log_link (qsl_id, log_id) VALUES (?, ?)').run(qsl_id, log_id);
            count++;
          } catch (error) {
            console.warn(`跳过关联 ${qsl_id}-${log_id}:`, error.message);
          }
        });
        console.log(`✅ 迁移了 ${count} 条关联`);
      }
    }

    // 关闭旧数据库
    oldDb.close();

    console.log('🎉 迁移完成！');
    return { success: true, message: '数据库迁移成功' };

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
}

// CLI 执行
if (import.meta.url === `file://${process.argv[1]}`) {
  const pythonDbPath = process.argv[2] || path.join(__dirname, '../../database/qsl_manager_old.db');
  
  migrateFromPython(pythonDbPath)
    .then(() => {
      console.log('✅ 迁移成功完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 迁移错误:', error.message);
      process.exit(1);
    });
}

export default migrateFromPython;
