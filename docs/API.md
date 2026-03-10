# QSL Manager API 文档

## 📡 API 概览

QSL Manager 提供完整的 RESTful API，支持所有核心功能的程序化访问。

**Base URL**: `http://localhost:7055/api`

## 🔐 认证

当前版本不需要认证，所有 API 端点都是公开的。生产环境建议添加适当的认证机制。

## 📋 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "message": "操作成功" // 可选
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE" // 可选
}
```

## 🗂 API 端点

### 1. 系统状态 (System)

#### 健康检查
```http
GET /api/health
```

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-10T14:46:49.156Z"
}
```

#### 仪表板统计
```http
GET /api/stats/dashboard
```

**响应**:
```json
{
  "success": true,
  "data": {
    "total_logs": 150,
    "sent_cards": 45,
    "received_cards": 32,
    "pending_out": 8,
    "pending_in": 5,
    "out_stock": 37,
    "in_stock": 27
  }
}
```

#### 最近活动
```http
GET /api/stats/recent-activity?limit=10
```

**参数**:
- `limit` (可选): 返回记录数量，默认 10

### 2. 日志管理 (Logs)

#### 获取日志列表
```http
GET /api/logs?page=1&limit=50&my_callsign=&station_callsign=&mode=&band=&qsl_id=
```

**参数**:
- `page`: 页码，默认 1
- `limit`: 每页记录数，默认 50
- `my_callsign`: 我方呼号过滤
- `station_callsign`: 对方呼号过滤
- `mode`: 模式过滤
- `band`: 波段过滤
- `qsl_id`: QSL ID 过滤

**响应**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "my_callsign": "BH2VSQ",
        "station_callsign": "BA1PK",
        "qso_date": "20220321",
        "time_on": "1230",
        "freq": 14.205,
        "band": "20M",
        "mode": "SSB",
        "rst_sent": "59",
        "rst_rcvd": "59",
        "qsl_sent": "Y",
        "qsl_rcvd": "N",
        "comment": "Nice QSO"
      }
    ],
    "total": 150
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

#### 获取单条日志
```http
GET /api/logs/:id
```

#### 创建日志
```http
POST /api/logs
Content-Type: application/json

{
  "my_callsign": "BH2VSQ",
  "station_callsign": "BA1PK",
  "qso_date": "20220321",
  "time_on": "1230",
  "freq": 14.205,
  "band": "20M",
  "mode": "SSB",
  "rst_sent": "59",
  "rst_rcvd": "59",
  "comment": "Nice QSO"
}
```

#### 更新日志
```http
PUT /api/logs/:id
Content-Type: application/json

{
  "comment": "Updated comment"
}
```

#### 删除日志
```http
DELETE /api/logs/:id
```

#### ADIF 导入
```http
POST /api/logs/import/adif
Content-Type: multipart/form-data

file: [ADIF文件]
```

#### ADIF 导出
```http
GET /api/logs/export/adif?my_callsign=&station_callsign=&mode=&band=
```

### 3. QSL 卡片管理 (QSL Cards)

#### 生成 QSL 卡片
```http
POST /api/qsl/generate
Content-Type: application/json

{
  "log_ids": [1, 2, 3],
  "direction": "TC", // TC 或 RC
  "mode": "multi" // single 或 multi
}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "qsl_id": "24000001TC001",
      "log_ids": [1]
    }
  ],
  "print_queue_items": [
    {
      "id": 1,
      "type": "qsl_label",
      "qsl_id": "24000001TC001",
      "layout": 1,
      "status": "ready"
    }
  ]
}
```

#### 搜索 QSL 卡片
```http
GET /api/qsl/search?prefix=24000001&status=pending,in_stock,out_stock
```

**参数**:
- `prefix`: QSL ID 前缀
- `status`: 状态过滤，逗号分隔

#### 扫码出入库
```http
POST /api/qsl/scan
Content-Type: application/json

{
  "qsl_id": "24000001TC001"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Card 已出库 (Date: 20220321)",
  "data": {
    "qsl_id": "24000001TC001",
    "direction": "TC",
    "status": "out_stock",
    "date": "20220321",
    "updated_logs": 1,
    "callsign": "BA1PK",
    "station_callsign": "BH2VSQ",
    "log_count": 1
  }
}
```

#### 获取 QSL 卡片详情
```http
GET /api/qsl/:qsl_id
```

#### 回收 QSL 卡号
```http
DELETE /api/qsl/:qsl_id/log/:log_id
```

### 4. 打印管理 (Print)

#### 获取打印队列
```http
GET /api/print/queue
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "qsl_label",
      "qsl_id": "24000001TC001",
      "layout": 1,
      "logs": [
        {
          "id": 1,
          "station_callsign": "BA1PK",
          "qso_date": "20220321"
        }
      ],
      "status": "ready",
      "created_at": "2022-03-21T12:30:00.000Z"
    }
  ]
}
```

#### 添加到打印队列
```http
POST /api/print/queue
Content-Type: application/json

{
  "type": "address_label",
  "sender": {
    "name": "张三",
    "address": "北京市朝阳区",
    "zip": "100000",
    "phone": "13800138000"
  }
}
```

#### 生成打印 HTML
```http
GET /api/print/html/:queue_id
```

#### 批量打印 HTML
```http
POST /api/print/html/batch
Content-Type: application/json

{
  "queue_ids": [1, 2, 3]
}
```

#### 从队列移除
```http
DELETE /api/print/queue/:id
```

#### 清空队列
```http
DELETE /api/print/queue
```

### 5. 地址簿管理 (Address Book)

#### 获取地址列表
```http
GET /api/address?search=&page=1&limit=50
```

**参数**:
- `search`: 搜索关键词（呼号或姓名）
- `page`: 页码
- `limit`: 每页记录数

#### 获取单个地址
```http
GET /api/address/:callsign
```

#### 创建地址
```http
POST /api/address
Content-Type: application/json

{
  "callsign": "BA1PK",
  "name": "张三",
  "phone": "13800138000",
  "address": "北京市朝阳区某某街道",
  "postal_code": "100000",
  "country": "中国"
}
```

#### 更新地址
```http
PUT /api/address/:callsign
Content-Type: application/json

{
  "name": "李四",
  "phone": "13900139000"
}
```

#### 删除地址
```http
DELETE /api/address/:callsign
```

#### 获取默认发信人
```http
GET /api/address/sender/default
```

#### 设置默认发信人
```http
POST /api/address/sender/default
Content-Type: application/json

{
  "name": "BH2VSQ",
  "phone": "13800138000",
  "address": "上海市浦东新区",
  "postal_code": "200000",
  "country": "中国"
}
```

### 6. 配置管理 (Config)

#### 获取配置
```http
GET /api/config
```

#### 更新配置
```http
PUT /api/config
Content-Type: application/json

{
  "default_my_callsign": "BH2VSQ",
  "default_rst_sent": "59",
  "default_rst_rcvd": "59"
}
```

#### 获取呼号列表
```http
GET /api/config/callsigns
```

## 🔧 错误代码

| 代码 | 说明 |
|------|------|
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 数据冲突（如重复记录） |
| 500 | 服务器内部错误 |

## 📝 使用示例

### JavaScript/Axios
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:7055/api',
  timeout: 10000
});

// 获取日志列表
const logs = await api.get('/logs?page=1&limit=10');

// 创建新日志
const newLog = await api.post('/logs', {
  my_callsign: 'BH2VSQ',
  station_callsign: 'BA1PK',
  qso_date: '20220321',
  time_on: '1230',
  freq: 14.205,
  mode: 'SSB'
});

// 生成 QSL 卡片
const qslCard = await api.post('/qsl/generate', {
  log_ids: [1],
  direction: 'TC',
  mode: 'single'
});
```

### Python/Requests
```python
import requests

base_url = 'http://localhost:7055/api'

# 获取日志列表
response = requests.get(f'{base_url}/logs?page=1&limit=10')
logs = response.json()

# 创建新日志
log_data = {
    'my_callsign': 'BH2VSQ',
    'station_callsign': 'BA1PK',
    'qso_date': '20220321',
    'time_on': '1230',
    'freq': 14.205,
    'mode': 'SSB'
}
response = requests.post(f'{base_url}/logs', json=log_data)
```

### cURL
```bash
# 获取健康状态
curl http://localhost:7055/api/health

# 获取日志列表
curl "http://localhost:7055/api/logs?page=1&limit=10"

# 创建新日志
curl -X POST http://localhost:7055/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "my_callsign": "BH2VSQ",
    "station_callsign": "BA1PK",
    "qso_date": "20220321",
    "time_on": "1230",
    "freq": 14.205,
    "mode": "SSB"
  }'
```

## 🔄 版本控制

API 版本通过 URL 路径管理：
- 当前版本: `/api/` (v1)
- 未来版本: `/api/v2/`

## 📊 限流

生产环境建议配置适当的限流策略：
- 每个 IP 每分钟最多 100 请求
- 文件上传限制 10MB
- 批量操作限制 1000 条记录

---

**注意**: API 文档会随着功能更新而变化，请关注版本更新说明。