# QSL Manager 数据库结构文档

## 概述

QSL Manager 使用 SQLite 数据库存储数据，采用双数据库架构：
- **主数据库** (`qsl_manager.db`): 存储日志、QSL卡片等核心业务数据
- **地址数据库** (`address.db`): 存储地址簿和发件人信息

## 主数据库 (qsl_manager.db)

### 1. logs 表 - 日志记录

存储业余无线电通联日志记录。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 日志唯一标识 |
| sort_id | INTEGER | | 排序ID，用于自定义排序 |
| my_callsign | TEXT | | 我方呼号 |
| station_callsign | TEXT | NOT NULL | 对方呼号 |
| qso_date | TEXT | NOT NULL | 通联日期 (YYYYMMDD) |
| time_on | TEXT | NOT NULL | 开始时间 (HHMMSS) |
| time_off | TEXT | | 结束时间 (HHMMSS) |
| band | TEXT | | 波段 |
| band_rx | TEXT | | 接收波段 |
| freq | REAL | | 频率 (MHz) |
| freq_rx | REAL | | 接收频率 (MHz) |
| mode | TEXT | | 通信模式 (SSB, CW, FT8等) |
| submode | TEXT | | 子模式 |
| rst_sent | TEXT | | 发送信号报告 |
| rst_rcvd | TEXT | | 接收信号报告 |
| tx_pwr | REAL | | 发射功率 (W) |
| comment | TEXT | | 备注 |
| notes | TEXT | | 笔记 |
| qsl_sent | TEXT | DEFAULT 'N' | QSL发送状态 (Y/N) |
| qsl_rcvd | TEXT | DEFAULT 'N' | QSL接收状态 (Y/N) |
| qsl_sent_date | TEXT | | QSL发送日期 (YYYYMMDD) |
| qsl_rcvd_date | TEXT | | QSL接收日期 (YYYYMMDD) |
| sat_name | TEXT | | 卫星名称 |
| sat_mode | TEXT | | 卫星模式 |
| prop_mode | TEXT | | 传播模式 |
| my_gridsquare | TEXT | | 我方网格坐标 |
| gridsquare | TEXT | | 对方网格坐标 |
| repeater_callsign | TEXT | | 中继台呼号 |
| repeater_location | TEXT | | 中继台位置 |
| uplink_freq | REAL | | 上行频率 |
| downlink_freq | REAL | | 下行频率 |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引:**
- `idx_logs_callsign` ON `station_callsign`
- `idx_logs_date` ON `qso_date`

### 2. qsl_cards 表 - QSL卡片

存储QSL卡片信息和状态。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| qsl_id | TEXT | PRIMARY KEY | QSL卡片ID (格式: YYYYNNNNNDD) |
| direction | TEXT | NOT NULL | 方向 (TC=发卡, RC=收卡) |
| status | TEXT | DEFAULT 'pending' | 状态 (pending/in_stock/out_stock) |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**状态说明:**
- `pending`: 待处理 (已分配卡号但未出入库)
- `in_stock`: 已入库 (收卡已收到)
- `out_stock`: 已出库 (发卡已发出)

**索引:**
- `idx_qsl_status` ON `status`

### 3. qsl_log_link 表 - QSL卡片与日志关联

建立QSL卡片与日志记录的多对多关系。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| qsl_id | TEXT | NOT NULL | QSL卡片ID |
| log_id | INTEGER | NOT NULL | 日志ID |

**约束:**
- PRIMARY KEY (`qsl_id`, `log_id`)
- FOREIGN KEY (`qsl_id`) REFERENCES `qsl_cards(qsl_id)` ON DELETE CASCADE
- FOREIGN KEY (`log_id`) REFERENCES `logs(id)` ON DELETE CASCADE

### 4. callsigns 表 - 呼号记录

存储已通联的呼号列表，用于自动补全等功能。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| callsign | TEXT | PRIMARY KEY | 呼号 |

## 地址数据库 (address.db)

### 1. addresses 表 - 地址簿

存储通联对象的地址信息。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| callsign | TEXT | PRIMARY KEY | 呼号 |
| name | TEXT | | 姓名 |
| phone | TEXT | | 电话号码 |
| address | TEXT | | 地址 |
| postal_code | TEXT | | 邮政编码 |
| country | TEXT | | 国家 |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 2. sender_default 表 - 发件人默认信息

存储发件人的默认地址信息，用于打印地址标签。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY CHECK (id = 1) | 固定ID=1，确保只有一条记录 |
| name | TEXT | | 发件人姓名 |
| phone | TEXT | | 发件人电话 |
| address | TEXT | | 发件人地址 |
| postal_code | TEXT | | 发件人邮政编码 |
| country | TEXT | | 发件人国家 |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

## 数据库关系图

```
logs (1) ←→ (N) qsl_log_link (N) ←→ (1) qsl_cards
  ↓
callsigns (通过 station_callsign 关联)
  ↓
addresses (通过 callsign 关联)
```

## QSL卡号生成规则

QSL卡号格式: `YYYYNNNNNDD`
- `YYYY`: 年份 (4位)
- `NNNNN`: 序号 (5位，从00001开始)
- `DD`: 方向标识
  - `TC`: To Confirm (发卡)
  - `RC`: Received Confirm (收卡)

示例: `2024000001TC`, `2024000001RC`

## 业务流程

### 1. 日志管理流程
1. 导入/手动录入日志 → `logs` 表
2. 自动提取呼号 → `callsigns` 表
3. 关联地址信息 → `addresses` 表

### 2. QSL卡片管理流程
1. 选择日志生成QSL卡片 → `qsl_cards` 表
2. 建立卡片与日志关联 → `qsl_log_link` 表
3. 扫码出入库更新状态 → 更新 `qsl_cards.status` 和 `logs.qsl_*_date`

### 3. 地址管理流程
1. 维护地址簿 → `addresses` 表
2. 设置发件人信息 → `sender_default` 表
3. 打印地址标签时自动关联

## 数据迁移

系统支持从Python版本数据库迁移，迁移脚本会：
1. 保持原有数据结构兼容性
2. 自动转换状态字段
3. 建立正确的关联关系
4. 处理数据类型转换

## 性能优化

1. **索引策略**: 在常用查询字段上建立索引
2. **分页查询**: API支持分页避免大量数据加载
3. **事务处理**: 批量操作使用事务确保数据一致性
4. **连接池**: 使用SQL.js适配器管理数据库连接

## 备份与恢复

- 数据库文件位于 `database/` 目录
- 支持SQLite标准备份工具
- 可通过ADIF格式导入导出日志数据
- 地址数据可通过API批量导入导出