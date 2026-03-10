# 安装指南

## ⚠️ 重要提示

本项目使用 `better-sqlite3` 作为数据库驱动，该库需要本地编译。

## 🔧 安装方法

### 方法 1：使用 Node.js LTS 版本（推荐）

`better-sqlite3` 对 Node.js v22 的支持还不完善。建议使用 Node.js LTS 版本：

```bash
# 推荐使用 Node.js v20.x LTS
# 下载地址: https://nodejs.org/

# 安装依赖
npm install
```

### 方法 2：在 Windows 上安装编译工具

如果必须使用 Node.js v22，需要安装 Visual Studio Build Tools：

1. 下载并安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
2. 选择 "Desktop development with C++" 工作负载
3. 安装完成后运行：

```bash
npm install
```

### 方法 3：使用预编译的替代方案

如果无法安装编译工具，可以使用纯 JavaScript 的替代方案：

#### 替换为 sql.js

修改 `package.json`：

```json
{
  "dependencies": {
    "sql.js": "^1.10.3"
    // 移除 better-sqlite3
  }
}
```

然后使用提供的 `server/db/sqljs-adapter.js` 适配器。

**注意**: sql.js 性能较 better-sqlite3 差，且需要手动管理数据库持久化。

## 🚀 启动项目

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 生产模式

```bash
npm run build
node server.js
```

## 📦 依赖说明

### 需要编译的依赖
- `better-sqlite3` - SQLite 数据库驱动（需要 C++ 编译）

### 纯 JavaScript 依赖
- `express` - Web 框架
- `multer` - 文件上传
- `qrcode` - 二维码生成
- `jspdf` - PDF 生成
- `dayjs` - 日期处理
- `react` - 前端框架
- `antd` - UI 组件库

## 🔍 故障排除

### 问题 1: better-sqlite3 安装失败

**错误信息**: `gyp ERR! find VS`

**解决方案**:
1. 安装 Visual Studio Build Tools
2. 或使用 Node.js v20.x LTS
3. 或切换到 sql.js

### 问题 2: Node.js 版本不兼容

**错误信息**: `Error: Cannot find module`

**解决方案**:
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 问题 3: 端口被占用

**错误信息**: `EADDRINUSE`

**解决方案**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# 或修改端口
# 在 server.js 和 vite.config.js 中修改端口号
```

## 💡 推荐配置

### 开发环境
- Node.js: v20.x LTS
- npm: v10.x
- 操作系统: Windows 10/11, macOS, Linux

### 生产环境
- Node.js: v20.x LTS
- 内存: 至少 512MB
- 磁盘: 至少 100MB

## 📞 获取帮助

如果遇到安装问题，请：

1. 检查 Node.js 版本: `node --version`
2. 检查 npm 版本: `npm --version`
3. 查看完整错误日志
4. 参考 [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)

---

**最后更新: 2024-12-13**
