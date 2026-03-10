# 地址标签单页打印更新

## 需求变更

**原设计**: 地址标签双页打印（P1发件人，P2收件人）
**新需求**: 地址标签单页打印，每次打印一张70mm x 50mm标签

## 变更说明

### 打印方式变更
- **原Python版本**: 一次生成两页标签（发信+收信）
- **新版本**: 拆分为单独打印，每次打印一张标签
- **标签尺寸**: 保持70mm x 50mm不变
- **内容**: 每张标签包含完整的发信或收信地址信息

### 使用场景
1. **发信地址标签**: 单独打印发件人信息
2. **收信地址标签**: 单独打印收件人信息
3. **灵活性**: 用户可以根据需要选择打印哪种类型

## 技术实现

### 1. 数据结构简化 ✅

**修改前**:
```javascript
// 需要同时处理sender和receiver
generateAddressPrintHTML({
  sender: { name: '...', address: '...' },
  receiver: { name: '...', address: '...' }
});
```

**修改后**:
```javascript
// 直接处理单个地址数据
generateAddressPrintHTML({
  name: 'BH2VSQ',
  address: '辽宁省沈阳市6010邮政信箱',
  postal_code: '110000',
  phone: '15502424829'
});
```

### 2. HTML结构简化 ✅

**修改前**: 双页HTML结构
```html
<body>
  <div class="address-page">发件人信息</div>
  <div style="page-break-before: always;">
    <div class="address-page">收件人信息</div>
  </div>
</body>
```

**修改后**: 单页HTML结构
```html
<body>
  <div class="address-page">
    <div class="address-content">
      <div class="title">FROM(发自): 或 TO(发往):</div>
      <div class="zip">110000</div>
      <div class="address-line">辽宁省沈阳市</div>
      <div class="address-line">6010邮政信箱</div>
      <div class="name">BH2VSQ</div>
      <div class="phone">TEL: 15502424829</div>
    </div>
  </div>
</body>
```

### 3. 智能标题判断 ✅

函数自动判断地址类型并设置合适的标题：
```javascript
// 自动判断逻辑
if (data.sender && data.receiver) {
  // 优先打印有数据的那个
  addressInfo = data.sender.name ? data.sender : data.receiver;
  roleTitle = data.sender.name ? 'FROM(发自)' : 'TO(发往)';
} else if (data.sender) {
  addressInfo = data.sender;
  roleTitle = 'FROM(发自)';
} else if (data.receiver) {
  addressInfo = data.receiver;
  roleTitle = 'TO(发往)';
}
```

### 4. 字段映射保持 ✅

继续支持`postal_code` → `zip`的字段映射：
```javascript
const normalizedInfo = {
  name: addressInfo.name || '',
  address: addressInfo.address || '',
  zip: addressInfo.zip || addressInfo.postal_code || '',
  phone: addressInfo.phone || '',
  country: addressInfo.country || ''
};
```

## CSS优化

### 单页布局优化
- 移除`page-break-after: always`
- 设置固定的body尺寸：70mm x 50mm
- 添加`overflow: hidden`防止内容溢出
- 优化行高和间距适应单页显示

```css
body {
  width: 70mm;
  height: 50mm;
  overflow: hidden;
}

.address-page {
  width: 70mm;
  height: 50mm;
  position: relative;
  /* 移除page-break-after */
}
```

## 兼容性

### 向后兼容
- 支持原有的`{sender: {}, receiver: {}}`格式
- 支持直接传递地址对象
- 支持`postal_code`和`zip`两种字段名

### 数据格式支持
1. **队列格式**: `{sender: {...}}` 或 `{receiver: {...}}`
2. **直接格式**: `{name: '...', address: '...', ...}`
3. **混合格式**: `{sender: {...}, receiver: {...}}` (优先有数据的)

## 测试场景

### 1. 发信地址标签
```javascript
{
  sender: {
    name: 'BH2VSQ',
    address: '辽宁省沈阳市6010邮政信箱',
    postal_code: '110000',
    phone: '15502424829'
  }
}
```
**预期**: 显示"FROM(发自):"标题

### 2. 收信地址标签
```javascript
{
  receiver: {
    name: 'JA1ABC',
    address: 'Tokyo Japan',
    zip: '100-0001'
  }
}
```
**预期**: 显示"TO(发往):"标题

### 3. 字段映射
```javascript
{
  sender: {
    postal_code: '110000' // 自动映射为zip
  }
}
```
**预期**: 正确显示邮编

## 优势

1. **灵活性**: 用户可以单独打印需要的地址类型
2. **节约**: 不需要打印不必要的空白标签
3. **简化**: 减少了分页逻辑的复杂性
4. **兼容**: 保持与原有系统的兼容性
5. **效率**: 单页打印更快，减少纸张浪费

修改已应用到：
- `server/services/printService.js` - 地址标签生成逻辑
- `server/routes/print.js` - 打印路由处理逻辑