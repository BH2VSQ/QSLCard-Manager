# QSL Card Manager - 迁移指南

## 📖 从 Python 版本迁移到 Web 版本

本指南将帮助您将现有的 Python/PyQt5 版本数据迁移到新的 Web 版本。

---

## 🔄 迁移步骤

### 1. 备份原数据库

在开始迁移前，请务必备份您的原始数据库：

```bash
cp database/qsl_manager.db database/qsl_manager_backup.db
```

### 2. 安装 Web 版本

```bash
# 克隆或下载项目
cd qsl-manager-web

# 安装依赖
npm install
```

### 3. 执行数据库迁移

```bash
# 方式 1: 使用默认路径（假设原数据库在 database/qsl_manager_old.db）
npm run migrate

# 方式 2: 指定原数据库路径
npm run migrate -- /path/to/your/old/qsl_manager.db
```

迁移脚本会自动：
- 复制所有呼号
- 复制所有通联日志
- 复制所有 QSL 卡片
- 转换卡片状态（旧版 → 新版三阶段状态）
- 保留所有关联关系

### 4. 验证迁移结果

启动服务器：

```bash
npm run dev
```

访问 http://localhost:3000，检查：
- [ ] 呼号列表是否完整
- [ ] 通联日志数量是否正确
- [ ] QSL 卡片状态是否正确
- [ ] 日志与卡片关联是否正常

---

## 🔍 状态转换规则

### 旧版状态 → 新版状态

| 旧版状态 | 条件 | 新版状态 |
|---------|------|---------|
| qsl_sent='Y' | 有 qsl_sent_date | out_stock（已出库） |
| qsl_rcvd='Y' | 有 qsl_rcvd_date | in_stock（已入库） |
| qsl_sent='Y' | 无 qsl_sent_date | pending（待出库） |
| qsl_rcvd='Y' | 无 qsl_rcvd_date | pending（待入库） |
| qsl_sent='N' | - | 未分配 |
| qsl_rcvd='N' | - | 未分配 |

### 新版三阶段状态

1. **未分配**: 日志存在，但未生成 QSL 卡号
2. **待出/入库** (pending): 已分配 QSL 卡号，但未扫码确认
3. **已出/入库** (out_stock/in_stock): 扫码确认完成

---

## 📊 数据库结构变化

### 新增字段

#### logs 表
- `created_at`: 创建时间戳
- `updated_at`: 更新时间戳

#### qsl_cards 表
- `status`: 状态字段（pending/in_stock/out_stock）
- `updated_at`: 更新时间戳

### 新增索引

```sql
CREATE INDEX idx_logs_sort ON logs(sort_id DESC);
CREATE INDEX idx_logs_callsign ON logs(station_callsign);
CREATE INDEX idx_logs_date ON logs(qso_date, time_on);
CREATE INDEX idx_qsl_direction ON qsl_cards(direction, status);
CREATE INDEX idx_qsl_created ON qsl_cards(created_at DESC);
```

---

## 🆕 新功能说明

### 1. 打印队列

**旧版**: 直接生成 PDF 并打印  
**新版**: 先添加到打印队列，批量预览后打印

```javascript
// 添加到打印队列
POST /api/print/queue
{
  "type": "qsl_label",
  "qsl_id": "24000001TC...",
  "layout": 1
}

// 生成 PDF
POST /api/print/generate/1

// 浏览器打印
window.print()
```

### 2. 地址库

**旧版**: 仅保存发件人默认地址  
**新版**: 独立地址库，按呼号存储

```javascript
// 保存地址
POST /api/address
{
  "callsign": "BH2VSQ",
  "name": "张三",
  "address": "北京市朝阳区..."
}

// 查询地址
GET /api/address/callsign/BH2VSQ
```

### 3. 连续日志记录

**旧版**: 每次保存后清空所有字段  
**新版**: 可选保留除呼号外的所有字段

```javascript
// 启用连续日志模式
const [continuousMode, setContinuousMode] = useState(true);

// 保存后保留字段
if (continuousMode) {
  setFormData({
    ...formData,
    station_callsign: '', // 仅清空呼号
    time_on: getCurrentUTC() // 更新时间
  });
}
```

### 4. 暗黑模式

**旧版**: 固定暗色主题  
**新版**: 可切换暗黑/白天模式，自动保存

```javascript
// 切换主题
const { theme, toggleTheme } = useThemeStore();
toggleTheme();
```

---

## 🔧 配置迁移

### config.json

旧版配置会自动迁移，新增字段：

```json
{
  "primary_callsign": "BH2VSQ",
  "nfc_port": "COM3",
  "nfc_baudrate": 9600,
  "theme": "light",           // 新增
  "continuous_log": false     // 新增
}
```

---

## 🚨 注意事项

### 1. 字体文件

确保字体文件存在：
- `fonts/MapleMonoNL-Regular.ttf` (英文)
- `fonts/Cinese.ttf` (中文)

如果缺失，PDF 生成会失败。

### 2. 临时文件清理

打印队列的 PDF 文件存储在 `temp/` 目录，建议定期清理：

```bash
# 手动清理
rm -rf temp/*.pdf

# 或在打印完成后自动清理（已实现）
```

### 3. 端口占用

- 前端: 3000
- 后端: 3001

如果端口被占用，修改 `vite.config.js` 和 `server.js`。

### 4. 浏览器兼容性

推荐使用：
- Chrome/Edge >= 90
- Firefox >= 88
- Safari >= 14

---

## 📱 移动端支持

Web 版本已预留完整 REST API，可用于开发移动端 App：

### API 基础地址
```
http://your-server:3001/api
```

### 认证（未来版本）
```javascript
headers: {
  'Authorization': 'Bearer <token>'
}
```

---

## 🐛 常见问题

### Q1: 迁移后日志数量不对？

**A**: 检查迁移日志输出，确认是否有错误。可能原因：
- 原数据库损坏
- 权限不足
- 磁盘空间不足

### Q2: QSL 卡片状态显示异常？

**A**: 检查 `qsl_sent_date` 和 `qsl_rcvd_date` 字段是否正确。可手动修复：

```sql
UPDATE logs 
SET qsl_sent_date = qso_date 
WHERE qsl_sent = 'Y' AND qsl_sent_date IS NULL;
```

### Q3: 打印功能无法使用？

**A**: 检查：
1. 字体文件是否存在
2. `temp/` 目录是否可写
3. 浏览器是否允许打印

### Q4: 暗黑模式不生效？

**A**: 清除浏览器缓存和 localStorage：

```javascript
localStorage.removeItem('qsl-theme-storage');
location.reload();
```

---

## 📞 技术支持

如遇到问题，请：
1. 查看 `project.log` 文件
2. 检查浏览器控制台错误
3. 查看服务器日志

---

## 🎉 迁移完成

恭喜！您已成功迁移到 Web 版本。

享受新功能：
- ✅ 三阶段出入库管理
- ✅ 打印队列
- ✅ 地址库
- ✅ 暗黑模式
- ✅ 连续日志记录
- ✅ 移动端 API 支持

73!
