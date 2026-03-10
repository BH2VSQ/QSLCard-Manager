# QSL Manager 部署文档

## 🚀 快速部署

### 系统要求

#### 最低要求
- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本
- **内存**: 512MB RAM
- **存储**: 100MB 可用空间
- **浏览器**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

#### 推荐配置
- **Node.js**: 20.0.0 或更高版本
- **内存**: 1GB RAM
- **存储**: 500MB 可用空间

### 安装步骤

#### 1. 获取源码
```bash
# 方式一：Git 克隆
git clone <repository-url>
cd QSL-Manager

# 方式二：下载压缩包
# 下载并解压到目标目录
```

#### 2. 安装依赖
```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

#### 3. 启动应用
```bash
# 开发模式启动
npm run dev

# 或
yarn dev
```

#### 4. 访问应用
- **前端**: http://localhost:7054
- **后端API**: http://localhost:7055/api
- **健康检查**: http://localhost:7055/api/health

## 🔧 配置选项

### 环境变量

创建 `.env` 文件（可选）：
```bash
# 服务器配置
PORT=7055
NODE_ENV=development

# API 配置
VITE_API_URL=http://localhost:7055/api

# 数据库路径
DB_PATH=./database/qsl_manager.db
ADDRESS_DB_PATH=./database/address.db
```

### 端口配置

#### 修改前端端口
编辑 `vite.config.js`:
```javascript
export default defineConfig({
  server: {
    port: 7054, // 修改为所需端口
    host: '0.0.0.0',
  },
});
```

#### 修改后端端口
编辑 `server.js`:
```javascript
const PORT = process.env.PORT || 7055; // 修改为所需端口
```

**注意**: 修改端口后需要同步更新 `vite.config.js` 中的代理配置。

## 🏗 生产环境部署

### 构建生产版本
```bash
# 构建前端
npm run build

# 启动生产服务器
NODE_ENV=production node server.js
```

### 使用 PM2 部署
```bash
# 安装 PM2
npm install -g pm2

# 创建 ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'qsl-manager',
    script: 'server.js',
    env: {
      NODE_ENV: 'development',
      PORT: 7055
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 7055
    }
  }]
}
EOF

# 启动应用
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 使用 Docker 部署

#### Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源码
COPY . .

# 构建前端
RUN npm run build

# 暴露端口
EXPOSE 7055

# 启动应用
CMD ["node", "server.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'
services:
  qsl-manager:
    build: .
    ports:
      - "7055:7055"
    volumes:
      - ./database:/app/database
      - ./temp:/app/temp
    environment:
      - NODE_ENV=production
      - PORT=7055
    restart: unless-stopped
```

#### 部署命令
```bash
# 构建和启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 🗄 数据库管理

### 自动初始化
系统首次启动时会自动：
- 创建 `database` 目录
- 初始化 `qsl_manager.db` 主数据库
- 初始化 `address.db` 地址数据库
- 创建所有必要的表和索引

### 数据备份
```bash
# 备份数据库文件
cp database/qsl_manager.db database/qsl_manager.db.backup
cp database/address.db database/address.db.backup

# 或使用脚本备份
node -e "
const fs = require('fs');
const date = new Date().toISOString().slice(0,10);
fs.copyFileSync('database/qsl_manager.db', \`database/qsl_manager_\${date}.db\`);
fs.copyFileSync('database/address.db', \`database/address_\${date}.db\`);
console.log('Backup completed');
"
```

### 数据恢复
```bash
# 恢复数据库
cp database/qsl_manager.db.backup database/qsl_manager.db
cp database/address.db.backup database/address.db
```

### Python 数据迁移
```bash
# 从 Python 版本迁移数据
node server/db/python-migration.js /path/to/python/qsl_manager.db
```

## 🔒 安全配置

### 生产环境安全
1. **使用 HTTPS**: 配置 SSL 证书
2. **防火墙**: 限制端口访问
3. **定期备份**: 自动化数据备份
4. **更新依赖**: 定期更新 npm 包

### 网络配置
```javascript
// server.js - 生产环境配置
if (process.env.NODE_ENV === 'production') {
  app.use(helmet()); // 安全头
  app.use(compression()); // 压缩
  app.use(rateLimit({ // 限流
    windowMs: 15 * 60 * 1000,
    max: 100
  }));
}
```

## 📊 监控和日志

### 应用监控
```bash
# PM2 监控
pm2 monit

# 查看日志
pm2 logs qsl-manager

# 重启应用
pm2 restart qsl-manager
```

### 健康检查
```bash
# 检查服务状态
curl http://localhost:7055/api/health

# 检查数据库连接
curl http://localhost:7055/api/stats/dashboard
```

## 🛠 故障排除

### 常见问题

#### 端口被占用
```bash
# 查找占用端口的进程
netstat -ano | findstr :7054
netstat -ano | findstr :7055

# 终止进程
taskkill /PID <进程ID> /F
```

#### 数据库权限问题
```bash
# 检查数据库目录权限
ls -la database/

# 修复权限
chmod 755 database/
chmod 644 database/*.db
```

#### 依赖安装失败
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
```

### 日志分析
```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 查看访问日志
tail -f logs/access.log
```

## 🔄 更新升级

### 应用更新
```bash
# 拉取最新代码
git pull origin main

# 更新依赖
npm install

# 重新构建
npm run build

# 重启服务
pm2 restart qsl-manager
```

### 数据库升级
系统会自动检测并升级数据库结构，无需手动操作。

---

**注意**: 生产环境部署前请确保进行充分测试，并制定完整的备份和恢复策略。