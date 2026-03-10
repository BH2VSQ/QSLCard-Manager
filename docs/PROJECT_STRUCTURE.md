# QSL Manager 项目结构

## 📁 目录结构

```
QSL-Manager/
├── 📁 src/                     # 前端源码
│   ├── 📁 components/          # React 组件
│   │   └── 📁 Layout/          # 布局组件
│   ├── 📁 pages/               # 页面组件
│   │   ├── Dashboard.jsx       # 仪表板
│   │   ├── LogEditor.jsx       # 日志编辑
│   │   ├── LogManagement.jsx   # 日志管理
│   │   ├── Scanner.jsx         # 手动查询
│   │   ├── Inventory.jsx       # 出入库管理
│   │   ├── PrintQueue.jsx      # 打印队列
│   │   ├── AddressBook.jsx     # 地址簿
│   │   ├── AddressLabel.jsx    # 地址标签
│   │   └── Settings.jsx        # 系统设置
│   ├── 📁 api/                 # API 接口封装
│   ├── 📁 utils/               # 工具函数
│   └── App.jsx                 # 主应用组件
├── 📁 server/                  # 后端源码
│   ├── 📁 routes/              # API 路由
│   │   ├── logs.js             # 日志管理 API
│   │   ├── qsl.js              # QSL 卡片 API
│   │   ├── print.js            # 打印管理 API
│   │   ├── address.js          # 地址簿 API
│   │   ├── config.js           # 配置管理 API
│   │   └── stats.js            # 统计信息 API
│   ├── 📁 services/            # 业务服务
│   │   ├── printService.js     # 打印服务
│   │   ├── pdfGenerator.js     # PDF 生成
│   │   └── qslGenerator.js     # QSL ID 生成
│   ├── 📁 db/                  # 数据库相关
│   │   ├── database.js         # 数据库入口
│   │   ├── sqljs-adapter.js    # SQLite 适配器
│   │   ├── migrations.js       # 数据库迁移
│   │   └── python-migration.js # Python 数据迁移
│   └── 📁 utils/               # 后端工具
│       └── adifParser.js       # ADIF 解析器
├── 📁 database/                # 数据库文件
│   ├── qsl_manager.db          # 主数据库
│   └── address.db              # 地址数据库
├── 📁 temp/                    # 临时文件目录
├── 📁 fonts/                   # 字体文件目录
├── 📁 docs/                    # 项目文档
│   ├── FEATURES.md             # 功能文档
│   ├── DEPLOYMENT.md           # 部署文档
│   ├── API.md                  # API 文档
│   ├── PROJECT_STRUCTURE.md    # 项目结构说明
│   ├── IMPORTANT_NOTE.md       # 重要说明
│   └── INSTALLATION_GUIDE.md   # 安装指南
├── 📁 archive/                 # 归档文件
│   └── ...                     # 开发过程文档
├── 📄 server.js                # 服务器入口
├── 📄 package.json             # 项目配置
├── 📄 vite.config.js           # Vite 配置
├── 📄 .env.example             # 环境变量示例
├── 📄 .gitignore               # Git 忽略文件
├── 📄 README.md                # 项目说明
├── 📄 MapleMonoNL-Regular.ttf  # 英文字体
├── 📄 Cinese.ttf               # 中文字体
└── 📄 main.py                  # Python 原版参考
```

## 🔧 核心文件说明

### 前端核心文件

#### `src/App.jsx`
- 主应用组件
- 路由配置
- 全局状态管理

#### `src/pages/`
- **Dashboard.jsx**: 系统仪表板，显示统计信息
- **LogEditor.jsx**: 日志编辑器，支持所有 QSO 字段
- **LogManagement.jsx**: 日志管理，列表、过滤、批量操作
- **Scanner.jsx**: 手动查询，QSL ID 查询功能
- **Inventory.jsx**: 出入库管理，扫码功能
- **PrintQueue.jsx**: 打印队列管理
- **AddressBook.jsx**: 地址簿管理
- **AddressLabel.jsx**: 地址标签生成
- **Settings.jsx**: 系统设置

#### `src/components/Layout/`
- **Layout.jsx**: 主布局组件
- **Layout.css**: 布局样式

### 后端核心文件

#### `server.js`
- Express 服务器入口
- 中间件配置
- 路由注册
- 静态文件服务

#### `server/routes/`
- **logs.js**: 日志 CRUD、ADIF 导入导出
- **qsl.js**: QSL 卡片生成、状态管理、扫码
- **print.js**: 打印队列、HTML 生成
- **address.js**: 地址簿 CRUD
- **config.js**: 系统配置管理
- **stats.js**: 统计信息查询

#### `server/services/`
- **printService.js**: 打印 HTML 生成服务
- **pdfGenerator.js**: PDF 生成服务（已弃用）
- **qslGenerator.js**: QSL ID 生成算法

#### `server/db/`
- **database.js**: 数据库初始化入口
- **sqljs-adapter.js**: SQLite 数据库适配器
- **migrations.js**: 数据库结构迁移
- **python-migration.js**: Python 版本数据迁移

### 配置文件

#### `package.json`
- 项目依赖管理
- 脚本命令定义
- 项目元信息

#### `vite.config.js`
- 前端构建配置
- 开发服务器配置
- 代理设置

#### `.env.example`
- 环境变量模板
- 配置项说明

## 🗄 数据库结构

### 主数据库 (qsl_manager.db)

#### `logs` 表
- QSO 日志记录
- 33 个字段，支持所有 ADIF 标准字段
- 包含 QSL 状态跟踪

#### `qsl_cards` 表
- QSL 卡片信息
- 卡片 ID、方向、状态管理

#### `qsl_log_link` 表
- QSL 卡片与日志的多对多关联

#### `callsigns` 表
- 呼号索引表

### 地址数据库 (address.db)

#### `addresses` 表
- 联系人地址信息
- 支持完整的邮寄地址字段

#### `sender_default` 表
- 默认发信人信息配置

## 🎨 前端技术栈

- **React 18**: 用户界面框架
- **Ant Design 5**: UI 组件库
- **Vite**: 构建工具和开发服务器
- **Axios**: HTTP 客户端
- **React Router**: 路由管理
- **Zustand**: 状态管理

## 🔧 后端技术栈

- **Node.js**: 运行时环境
- **Express**: Web 框架
- **SQL.js**: SQLite 数据库
- **Multer**: 文件上传处理
- **QRCode**: QR 码生成
- **Day.js**: 日期处理

## 📦 构建和部署

### 开发模式
```bash
npm run dev
```
- 前端: Vite 开发服务器 (端口 7054)
- 后端: Node.js Express 服务器 (端口 7055)

### 生产构建
```bash
npm run build
```
- 生成 `dist/` 目录
- 包含优化后的静态文件

### 生产部署
```bash
NODE_ENV=production node server.js
```
- 服务器同时提供 API 和静态文件服务

## 🔄 数据流

1. **用户操作** → 前端组件
2. **前端组件** → API 调用 (Axios)
3. **API 路由** → 业务服务
4. **业务服务** → 数据库操作
5. **数据库** → 返回结果
6. **API 响应** → 前端更新

## 📝 开发规范

### 文件命名
- React 组件: PascalCase (如 `LogEditor.jsx`)
- 工具函数: camelCase (如 `formatDate.js`)
- 常量文件: UPPER_CASE (如 `CONSTANTS.js`)

### 代码组织
- 每个功能模块独立的路由文件
- 业务逻辑封装在 services 中
- 数据库操作统一通过适配器
- 前端组件按功能分组

### API 设计
- RESTful 风格
- 统一的响应格式
- 适当的 HTTP 状态码
- 详细的错误信息

---

**注意**: 项目结构遵循现代 Web 应用的最佳实践，保持代码的可维护性和可扩展性。