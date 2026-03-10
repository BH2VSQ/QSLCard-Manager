# 地址标签打印错误修复

## 错误分析

从错误日志可以看出：

```
TypeError: Cannot read properties of undefined (reading 'address')
```

**问题原因**:
1. 队列项只有`sender`数据，`receiver`为`undefined`
2. `generateAddressPrintHTML`函数期望`{sender: {}, receiver: {}}`格式
3. 单页地址标签处理逻辑有误
4. 数据字段映射问题：`postal_code` vs `zip`

## 修复详情

### 1. 单页地址标签处理修复 ✅

**问题**: 单页格式时直接传递`addressData`给期望双页格式的函数
**修复**: 为单页格式创建完整的双页结构，空白页使用空对象

```javascript
// 修复前（错误）
htmlContent = generateAddressPrintHTML(addressData);

// 修复后（正确）
if (item.sender) {
  htmlContent = generateAddressPrintHTML({
    sender: item.sender,
    receiver: { name: '', address: '', zip: '', phone: '', country: '' }
  });
} else {
  htmlContent = generateAddressPrintHTML({
    sender: { name: '', address: '', zip: '', phone: '', country: '' },
    receiver: item.receiver
  });
}
```

### 2. 字段映射修复 ✅

**问题**: 数据中使用`postal_code`字段，但代码期望`zip`字段
**修复**: 添加字段映射支持两种命名

```javascript
const normalizedInfo = {
  name: info.name || '',
  address: info.address || '',
  zip: info.zip || info.postal_code || '', // 支持两种字段名
  phone: info.phone || '',
  country: info.country || ''
};
```

### 3. 批量处理同步修复 ✅

**修复**: 批量处理中应用相同的单页格式修复逻辑

## 数据结构

### 输入数据格式
```javascript
{
  id: 3,
  type: 'address_label',
  sender: {
    type: 'sender',
    name: 'BH2VSQ',
    phone: '15502424829',
    address: '辽宁省沈阳市6010邮政信箱',
    postal_code: '110000', // 注意：使用postal_code而非zip
    country: null
  },
  receiver: undefined, // 单页格式
  status: 'ready'
}
```

### 处理后的标准化格式
```javascript
{
  sender: {
    name: 'BH2VSQ',
    address: '辽宁省沈阳市6010邮政信箱',
    zip: '110000', // 映射postal_code -> zip
    phone: '15502424829',
    country: ''
  },
  receiver: {
    name: '',
    address: '',
    zip: '',
    phone: '',
    country: ''
  }
}
```

## 支持的地址标签格式

### 1. 双页格式（完整）
- P1: 发件人信息
- P2: 收件人信息
- 两页都有完整数据

### 2. 单页格式（发件人）
- P1: 发件人信息（完整）
- P2: 收件人信息（空白）

### 3. 单页格式（收件人）
- P1: 发件人信息（空白）
- P2: 收件人信息（完整）

## 测试验证

修复后应该能够：
1. ✅ 正确处理只有sender的地址标签
2. ✅ 正确处理只有receiver的地址标签
3. ✅ 正确处理同时有sender和receiver的地址标签
4. ✅ 正确映射postal_code字段到zip
5. ✅ 生成正确的双页HTML结构
6. ✅ 批量处理和单个处理都正常工作

## 错误预防

为了避免类似错误：
1. 添加了字段映射处理不同的命名约定
2. 确保所有代码路径都使用一致的数据结构
3. 为空数据提供默认值避免undefined错误
4. 统一单页和双页的处理逻辑

修复已应用到：
- `server/routes/print.js` - 单个和批量处理逻辑
- `server/services/printService.js` - 字段映射和数据标准化