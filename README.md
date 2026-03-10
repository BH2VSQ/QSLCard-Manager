# QSL Manager Web Application

QSL Manager 是一个现代化的业余无线电 QSL 卡片管理系统，从 Python/PyQt5 版本完全迁移到 Web 应用程序。

## 🚀 快速开始

### 系统要求
- Node.js 18+ 
- npm 或 yarn
- 现代浏览器（Chrome、Firefox、Safari、Edge）

### 一键启动
```bash
# 1. 克隆项目
git clone <repository-url>
cd QSL-Manager

# 2. 安装依赖
npm install

# 3. 启动应用（零配置）
npm run dev
```

### 访问地址
- **前端应用**: http://localhost:7054
- **后端API**: http://localhost:7055/api
- **健康检查**: http://localhost:7055/api/health

## ✨ 主要特性

### 🎯 核心功能
- **完整日志管理**: 支持所有 ADIF 标准字段的 QSO 记录
- **智能卡片系统**: 自动生成 QSL 卡片编号和状态跟踪
- **专业打印系统**: 70mm×50mm 标签打印，支持批量操作
- **出入库管理**: 扫码式 QSL 卡片状态管理
- **地址簿集成**: 完整的联系人地址管理
- **ADIF 兼容**: 完整的导入导出支持

### 🛠 技术特性
- **零配置启动**: 自动创建数据库和必要文件
- **纯 JavaScript**: 无需预编译，直接运行
- **响应式设计**: 支持各种屏幕尺寸
- **数据兼容**: 支持从 Python 版本无缝迁移
- **实时同步**: 前后端数据实时同步

## � 功能模块

| 模块 | 功能描述 | 主要特性 |
|------|----------|----------|
| 📊 **仪表板** | 系统概览和统计 | 实时数据、活动记录 |
| 📝 **日志管理** | QSO 记录管理 | CRUD、过滤、批量操作 |
| 🏷️ **QSL 卡片** | 卡片生成和管理 | 智能编号、状态跟踪 |
| �️ **打印系统** | 标签打印管理 | 批量打印、队列管理 |
| 📦 **出入库** | 扫码状态管理 | QR 扫码、状态更新 |
| 📇 **地址簿** | 联系人管理 | 地址管理、标签生成 |
| 🔍 **手动查询** | QSL ID 查询 | 详细信息查询 |
| ⚙️ **系统设置** | 配置管理 | 个性化设置 |

## 📚 文档

- [📖 功能文档](docs/FEATURES.md) - 详细功能说明和使用指南
- [🚀 部署文档](docs/DEPLOYMENT.md) - 部署配置和生产环境指南
- [📡 API 文档](docs/API.md) - 完整的 API 接口文档
- [📁 项目结构](docs/PROJECT_STRUCTURE.md) - 代码结构和架构说明

## � 技术栈

### 前端技术
- **React 18** - 现代化用户界面框架
- **Ant Design 5** - 企业级 UI 组件库
- **Vite** - 快速构建工具
- **Axios** - HTTP 客户端

### 后端技术
- **Node.js** - 服务器运行时
- **Express** - Web 应用框架
- **SQL.js** - 客户端 SQLite 数据库
- **Multer** - 文件上传处理

## 🔄 从 Python 版本迁移

### 数据迁移
```bash
# 自动迁移 Python 数据库
node server/db/python-migration.js /path/to/python/qsl_manager.db
```

### 功能对比
| 功能 | Python 版本 | Web 版本 | 状态 |
|------|-------------|----------|------|
| 日志管理 | ✅ | ✅ | 完全兼容 |
| QSL 卡片 | ✅ | ✅ | 功能增强 |
| 打印系统 | ✅ | ✅ | 布局精确 |
| ADIF 支持 | ✅ | ✅ | 完全兼容 |
| 地址管理 | ✅ | ✅ | 功能增强 |
| 出入库 | ✅ | ✅ | 体验优化 |

## 🎨 界面预览

- **现代化设计**: 简洁直观的用户界面
- **响应式布局**: 适配各种设备屏幕
- **暗色模式**: 支持明暗主题切换
- **中文界面**: 完整的中文本地化

## 📦 安装和配置

### 快速安装
```bash
# 使用 npm
npm install
npm run dev

# 使用 yarn
yarn install
yarn dev

# 使用 pnpm
pnpm install
pnpm dev
```

### 环境配置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置（可选）
# PORT=7055
# NODE_ENV=development
```

### 生产部署
```bash
# 构建生产版本
npm run build

# 启动生产服务器
NODE_ENV=production node server.js
```

## 🔧 开发指南

### 项目结构
```
QSL-Manager/
├── src/           # 前端源码
├── server/        # 后端源码
├── database/      # 数据库文件
├── docs/          # 项目文档
├── temp/          # 临时文件
└── fonts/         # 字体文件
```

### 开发命令
```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run preview  # 预览生产版本
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👨‍💻 作者

**BH2VSQ** - 业余无线电爱好者

## 🙏 致谢

- 感谢所有业余无线电社区的支持
- 感谢开源社区提供的优秀工具和库
- 特别感谢测试和反馈的朋友们

## 📞 支持

如果您在使用过程中遇到问题：

1. 查看 [文档](docs/) 获取详细信息
2. 搜索 [Issues](../../issues) 查看是否有类似问题
3. 创建新的 [Issue](../../issues/new) 报告问题
4. 联系作者获取技术支持

---

**🎯 项目目标**: 为业余无线电爱好者提供现代化、易用的 QSL 卡片管理解决方案

**📈 版本**: 2.0.0 (Web 版本)

**🔄 更新**: 持续维护和功能增强