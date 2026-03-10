import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '../../database');
const MAIN_DB_PATH = path.join(DB_DIR, 'qsl_manager.db');
const ADDRESS_DB_PATH = path.join(DB_DIR, 'address.db');

let SQL;
let mainDb;
let addressDb;

// 确保数据库目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

/**
 * 初始化 SQL.js
 */
export async function initDatabase() {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  // 加载或创建主数据库
  if (fs.existsSync(MAIN_DB_PATH)) {
    const buffer = fs.readFileSync(MAIN_DB_PATH);
    mainDb = new SQL.Database(buffer);
  } else {
    mainDb = new SQL.Database();
    createMainSchema();
    saveMainDatabase();
  }

  // 加载或创建地址数据库
  if (fs.existsSync(ADDRESS_DB_PATH)) {
    const buffer = fs.readFileSync(ADDRESS_DB_PATH);
    addressDb = new SQL.Database(buffer);
  } else {
    addressDb = new SQL.Database();
    createAddressSchema();
    saveAddressDatabase();
  }

  console.log('✓ 数据库初始化成功');
  return { mainDb, addressDb };
}

/**
 * 保存主数据库到文件
 */
export function saveMainDatabase() {
  if (mainDb) {
    const data = mainDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(MAIN_DB_PATH, buffer);
  }
}

/**
 * 保存地址数据库到文件
 */
export function saveAddressDatabase() {
  if (addressDb) {
    const data = addressDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(ADDRESS_DB_PATH, buffer);
  }
}

/**
 * 创建主数据库架构
 */
function createMainSchema() {
  mainDb.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sort_id INTEGER,
      my_callsign TEXT,
      station_callsign TEXT NOT NULL,
      qso_date TEXT NOT NULL,
      time_on TEXT NOT NULL,
      time_off TEXT,
      band TEXT,
      band_rx TEXT,
      freq REAL,
      freq_rx REAL,
      mode TEXT,
      submode TEXT,
      rst_sent TEXT,
      rst_rcvd TEXT,
      tx_pwr REAL,
      comment TEXT,
      notes TEXT,
      qsl_sent TEXT DEFAULT 'N',
      qsl_rcvd TEXT DEFAULT 'N',
      qsl_sent_date TEXT,
      qsl_rcvd_date TEXT,
      sat_name TEXT,
      sat_mode TEXT,
      prop_mode TEXT,
      my_gridsquare TEXT,
      gridsquare TEXT,
      repeater_callsign TEXT,
      repeater_location TEXT,
      uplink_freq REAL,
      downlink_freq REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  mainDb.run(`
    CREATE TABLE IF NOT EXISTS qsl_cards (
      qsl_id TEXT PRIMARY KEY,
      direction TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  mainDb.run(`
    CREATE TABLE IF NOT EXISTS qsl_log_link (
      qsl_id TEXT NOT NULL,
      log_id INTEGER NOT NULL,
      PRIMARY KEY (qsl_id, log_id),
      FOREIGN KEY (qsl_id) REFERENCES qsl_cards(qsl_id) ON DELETE CASCADE,
      FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
    )
  `);

  mainDb.run(`
    CREATE TABLE IF NOT EXISTS callsigns (
      callsign TEXT PRIMARY KEY
    )
  `);

  // 创建索引
  mainDb.run(`CREATE INDEX IF NOT EXISTS idx_logs_callsign ON logs(station_callsign)`);
  mainDb.run(`CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(qso_date)`);
  mainDb.run(`CREATE INDEX IF NOT EXISTS idx_qsl_status ON qsl_cards(status)`);
  
  saveMainDatabase();
}

/**
 * 创建地址数据库架构
 */
function createAddressSchema() {
  // 创建 addresses 表
  addressDb.run(`
    CREATE TABLE IF NOT EXISTS addresses (
      callsign TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      address TEXT,
      postal_code TEXT,
      country TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建 sender_default 表
  addressDb.run(`
    CREATE TABLE IF NOT EXISTS sender_default (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT,
      phone TEXT,
      address TEXT,
      postal_code TEXT,
      country TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 检查并添加缺失的字段（用于现有数据库升级）
  try {
    // 检查 addresses 表是否有 phone 字段
    const addressesInfo = addressDb.exec("PRAGMA table_info(addresses)");
    if (addressesInfo[0]) {
      const columns = addressesInfo[0].values.map(row => row[1]); // 字段名在索引1
      if (!columns.includes('phone')) {
        console.log('📝 添加 addresses.phone 字段...');
        addressDb.run('ALTER TABLE addresses ADD COLUMN phone TEXT');
      }
    }

    // 检查 sender_default 表是否有 phone 字段
    const senderInfo = addressDb.exec("PRAGMA table_info(sender_default)");
    if (senderInfo[0]) {
      const columns = senderInfo[0].values.map(row => row[1]);
      if (!columns.includes('phone')) {
        console.log('📝 添加 sender_default.phone 字段...');
        addressDb.run('ALTER TABLE sender_default ADD COLUMN phone TEXT');
      }
    }
  } catch (error) {
    console.warn('检查/添加字段时出错:', error.message);
  }
  
  saveAddressDatabase();
}

/**
 * 执行查询并返回所有结果
 */
export function all(sql, params = [], dbType = 'main') {
  const db = dbType === 'address' ? addressDb : mainDb;
  
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  } catch (error) {
    console.error('SQL Error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * 执行单条查询
 */
export function get(sql, params = [], dbType = 'main') {
  const results = all(sql, params, dbType);
  return results.length > 0 ? results[0] : null;
}

/**
 * 执行写入操作
 */
export function run(sql, params = [], dbType = 'main') {
  const db = dbType === 'address' ? addressDb : mainDb;
  
  try {
    db.run(sql, params);
    
    // 获取影响的行数和最后插入的 ID
    const changes = db.getRowsModified();
    let lastInsertRowid = 0;
    
    if (changes > 0 && sql.trim().toUpperCase().startsWith('INSERT')) {
      const result = db.exec("SELECT last_insert_rowid() as id");
      if (result.length > 0 && result[0].values.length > 0) {
        lastInsertRowid = result[0].values[0][0];
      }
    }
    
    // 保存到文件
    if (dbType === 'address') {
      saveAddressDatabase();
    } else {
      saveMainDatabase();
    }
    
    return {
      changes,
      lastInsertRowid
    };
  } catch (error) {
    console.error('SQL Error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * 执行事务
 */
export function transaction(callback, dbType = 'main') {
  const db = dbType === 'address' ? addressDb : mainDb;
  
  try {
    db.run('BEGIN TRANSACTION');
    const result = callback();
    db.run('COMMIT');
    
    // 保存到文件
    if (dbType === 'address') {
      saveAddressDatabase();
    } else {
      saveMainDatabase();
    }
    
    return result;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

/**
 * 创建 prepare 对象（兼容 better-sqlite3 API）
 */
export function prepare(sql, dbType = 'main') {
  return {
    all: (...params) => {
      // 如果传入多个参数，将它们组合成数组
      // 如果传入一个数组，直接使用
      const paramArray = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return all(sql, paramArray, dbType);
    },
    get: (...params) => {
      const paramArray = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return get(sql, paramArray, dbType);
    },
    run: (...params) => {
      const paramArray = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return run(sql, paramArray, dbType);
    },
  };
}

/**
 * 获取数据库实例
 */
export function getDb(dbType = 'main') {
  return dbType === 'address' ? addressDb : mainDb;
}

// 导出兼容 better-sqlite3 的 API
export const db = {
  prepare: (sql) => prepare(sql, 'main'),
  exec: (sql) => {
    mainDb.run(sql);
    saveMainDatabase();
  },
  transaction: (callback) => transaction(callback, 'main'),
};

export const addressDbInstance = {
  prepare: (sql) => prepare(sql, 'address'),
  exec: (sql) => {
    addressDb.run(sql);
    saveAddressDatabase();
  },
  transaction: (callback) => transaction(callback, 'address'),
};

export default {
  initDatabase,
  saveMainDatabase,
  saveAddressDatabase,
  all,
  get,
  run,
  prepare,
  transaction,
  getDb,
  db,
  addressDbInstance
};

