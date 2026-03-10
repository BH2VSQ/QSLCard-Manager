import { initDatabase, db, addressDbInstance } from './sqljs-adapter.js';

// 初始化数据库
await initDatabase();

// 导出数据库实例
export { db, addressDbInstance as addressDb };
export default db;
