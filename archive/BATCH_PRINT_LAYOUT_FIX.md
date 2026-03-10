# 批量打印布局修复

## 问题分析

**问题**: 合并打印会造成标签布局丢失
**原因**: 批量打印时只提取body内容，丢失了CSS样式

## 根本原因

### 1. CSS样式丢失
批量打印的原逻辑：
```javascript
// 只提取body内容
const bodyMatch = itemHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const bodyContent = bodyMatch[1];
combinedHTML += `<div class="print-item">${bodyContent}</div>`;
```

问题：
- 丢失了每个标签的专用CSS样式
- 使用通用的`.print-item`样式无法满足不同标签的需求
- 字体、尺寸、布局全部错乱

### 2. 样式冲突
不同类型的标签有不同的CSS需求：
- **QSL标签**: 复杂的6x6网格布局，特殊字体，精确定位
- **地址标签**: 简单的垂直布局，中英文字体混合，高度控制

使用统一的`.print-item`样式无法兼容。

## 修复方案

### 1. 保留完整CSS样式 ✅

**新的批量打印逻辑**:
```javascript
// 收集所有CSS样式
let allStyles = new Set();
let allPages = [];

for (const queueId of queue_ids) {
  // 提取CSS样式
  const styleMatch = itemHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    allStyles.add(styleMatch[1]);
  }
  
  // 提取body内容
  const bodyMatch = itemHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  // ...
}

// 合并所有样式
const combinedStyles = Array.from(allStyles).join('\n\n');
```

### 2. 智能分页处理 ✅

```javascript
// 检查是否包含多页内容
if (bodyContent.includes('page-break-before: always')) {
  // 多页内容（如QSL标签），直接添加
  allPages.push(bodyContent);
} else {
  // 单页内容（如地址标签），添加分页符
  if (allPages.length > 0) {
    allPages.push(`<div style="page-break-before: always;">${bodyContent}</div>`);
  } else {
    allPages.push(bodyContent);
  }
}
```

### 3. 样式去重和合并 ✅

使用`Set`数据结构自动去重相同的CSS样式：
```javascript
let allStyles = new Set(); // 自动去重
// ...
const combinedStyles = Array.from(allStyles).join('\n\n');
```

## 修复效果

### 修复前 ❌
```html
<html>
<head>
  <style>
    /* 通用的print-item样式，无法满足所有标签需求 */
    .print-item { width: 70mm; height: 50mm; }
  </style>
</head>
<body>
  <div class="print-item"><!-- QSL标签内容，布局错乱 --></div>
  <div class="print-item"><!-- 地址标签内容，字体错误 --></div>
</body>
</html>
```

### 修复后 ✅
```html
<html>
<head>
  <style>
    /* QSL标签的完整CSS样式 */
    @page { size: 70mm 50mm; margin: 0; }
    @font-face { font-family: 'MapleMono'; src: url('/MapleMonoNL-Regular.ttf'); }
    .qso-grid { display: grid; grid-template-rows: repeat(6, 1fr); }
    /* ... 完整的QSL样式 */
    
    /* 地址标签的完整CSS样式 */
    .address-page { width: 70mm; height: 50mm; }
    .address-content { max-height: 41mm; overflow: hidden; }
    /* ... 完整的地址样式 */
  </style>
</head>
<body>
  <!-- QSL标签内容，保持原有布局 -->
  <div class="qsl-page">...</div>
  
  <!-- 地址标签内容，保持原有布局 -->
  <div style="page-break-before: always;">
    <div class="address-page">...</div>
  </div>
</body>
</html>
```

## 技术优势

### 1. 样式完整性
- 每个标签保持原有的CSS样式
- 字体、布局、尺寸完全一致
- 支持复杂的网格布局和绝对定位

### 2. 自动去重
- 相同的CSS样式自动去重
- 减少HTML文件大小
- 避免样式冲突

### 3. 智能分页
- 多页内容（QSL标签）保持原有分页
- 单页内容（地址标签）自动添加分页符
- 确保每个标签独立打印

### 4. 兼容性
- 支持混合打印不同类型的标签
- QSL标签 + 地址标签可以在同一批次打印
- 每种标签保持各自的最佳布局

## 测试场景

### 1. 纯QSL标签批量打印
- 保持6x6网格布局
- 多页QSL标签正确分页
- 字体和定位精确

### 2. 纯地址标签批量打印  
- 保持垂直布局
- 每个地址标签独立一页
- 高度控制防止分页

### 3. 混合标签批量打印
- QSL标签和地址标签混合
- 每种标签保持各自样式
- 正确的分页和布局

修复已应用到 `server/routes/print.js`，现在批量打印会保持每个标签的完整布局和样式。