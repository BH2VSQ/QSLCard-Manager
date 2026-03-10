import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 7055;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
// 添加字体文件的直接访问
app.use('/MapleMonoNL-Regular.ttf', express.static(path.join(__dirname, 'MapleMonoNL-Regular.ttf')));
app.use('/Cinese.ttf', express.static(path.join(__dirname, 'Cinese.ttf')));

// 确保必要的目录存在
const ensureDirectories = () => {
  const dirs = ['database', 'temp', 'fonts'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
};

ensureDirectories();

// 数据库会在导入路由时自动初始化
// （database.js 使用 top-level await）

// 导入路由
import logsRouter from './server/routes/logs.js';
import qslRouter from './server/routes/qsl.js';
import addressRouter from './server/routes/address.js';
import printRouter from './server/routes/print.js';
import configRouter from './server/routes/config.js';
import statsRouter from './server/routes/stats.js';

// 注册路由
app.use('/api/logs', logsRouter);
app.use('/api/qsl', qslRouter);
app.use('/api/address', addressRouter);
app.use('/api/print', printRouter);
app.use('/api/config', configRouter);
app.use('/api/stats', statsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 生产环境：提供静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
