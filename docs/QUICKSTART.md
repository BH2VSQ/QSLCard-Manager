# QSL Manager 快速开始指南

## 🚀 5分钟快速启动

### 第一步：环境准备
确保您的系统已安装：
- **Node.js 18+** ([下载地址](https://nodejs.org/))
- **现代浏览器** (Chrome、Firefox、Safari、Edge)

### 第二步：获取代码
```bash
# 下载项目
git clone <repository-url>
cd QSL-Manager

# 或直接下载压缩包并解压
```

### 第三步：一键启动
```bash
# 安装依赖并启动（自动化）
npm install && npm run dev
```

### 第四步：开始使用
打开浏览器访问：**http://localhost:7054**

## ✅ 启动成功标志

看到以下信息表示启动成功：
```
✓ 数据库初始化成功
🚀 Server running on http://localhost:7055
📊 API available at http://localhost:7055/api
🌐 Environment: development

VITE v5.4.21  ready in 569 ms
➜  Local:   http://localhost:7054/
```

## 🎯 首次使用

### 1. 系统概览
- 访问 **仪表板** 查看系统状态
- 所有数据库和配置已自动创建

### 2. 创建第一条日志
1. 点击 **日志管理** → **新建日志**
2. 填写基本信息：呼号、日期、时间、频率
3. 点击 **保存** 完成创建

### 3. 生成 QSL 卡片
1. 在日志列表中选择记录
2. 点击 **确认发卡(TC)** 或 **确认收卡(RC)**
3. 选择单卡或多卡模式
4. 系统自动生成卡号并加入打印队列

### 4. 打印标签
1. 访问 **打印队列**
2. 点击 **打印** 按钮
3. 浏览器将打开打印预览

## 🔧 常用功能

| 功能 | 位置 | 说明 |
|------|------|------|
| 添加日志 | 日志管理 → 新建 | 记录 QSO 通联 |
| 导入 ADIF | 日志管理 → 导入 | 批量导入日志 |
| 生成卡片 | 日志管理 → 确认发卡/收卡 | 分配 QSL 编号 |
| 扫码管理 | 出入库管理 | 扫描 QR 码更新状态 |
| 地址管理 | 地址簿 | 管理联系人信息 |
| 打印标签 | 打印队列 | 打印 QSL 和地址标签 |

## ❓ 常见问题

### Q: 端口被占用怎么办？
A: 修改 `vite.config.js` 和 `server.js` 中的端口号

### Q: 如何导入 Python 版本的数据？
A: 运行 `node server/db/python-migration.js /path/to/python/qsl_manager.db`

### Q: 打印标签尺寸不对？
A: 系统使用 70mm×50mm 标签，请检查打印机设置

### Q: 如何备份数据？
A: 复制 `database/` 目录下的 `.db` 文件

## 📚 更多帮助

- [完整功能文档](FEATURES.md)
- [部署指南](DEPLOYMENT.md)
- [API 文档](API.md)
- [项目结构](PROJECT_STRUCTURE.md)

## 🆘 获取支持

遇到问题？
1. 查看文档解决常见问题
2. 检查浏览器控制台错误信息
3. 创建 Issue 报告问题

---

**🎉 恭喜！您已成功启动 QSL Manager，开始您的业余无线电 QSL 管理之旅吧！**