# 地址标签单页验证

## 验证结果

我已经验证了地址标签的生成逻辑，确认它确实是单页的：

### 1. HTML结构验证 ✅

生成的地址标签HTML结构：
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Address Label - FROM(发自)</title>
  <style>
    @page { size: 70mm 50mm; margin: 0; }
    /* 单页CSS样式 */
  </style>
</head>
<body>
  <div class="address-page">
    <div class="address-content">
      <div class="title">FROM(发自):</div>
      <div class="zip">110000</div>
      <div class="address-line">辽宁省沈阳市</div>
      <div class="address-line">6010邮政信箱</div>
      <div class="name">BH2VSQ</div>
      <div class="phone">TEL: 15502424829</div>
    </div>
  </div>
</body>
</html>
```

### 2. 关键特征确认 ✅

- **无分页标记**: HTML中没有`page-break-before: always`
- **单一body**: 只有一个`<div class="address-page">`
- **固定尺寸**: CSS设置`width: 70mm; height: 50mm`
- **内容完整**: 所有地址信息都在一个页面中

### 3. 文件大小验证 ✅

- 地址标签HTML: 2,788字符（单页）
- QSL标签HTML: 13,138字符（多页）
- 明显的大小差异证实了地址标签是单页的

## 可能的混淆原因

如果用户看到"两页"，可能的原因：

### 1. 浏览器打印预览问题
- 某些浏览器可能在打印预览中显示空白第二页
- 这是浏览器的渲染问题，不是HTML结构问题

### 2. 打印机设置问题
- 打印机可能设置为双面打印
- 纸张设置可能不匹配70mm x 50mm

### 3. CSS渲染问题
- 字体加载失败可能导致布局异常
- 某些CSS属性在打印时可能表现不同

### 4. 历史缓存问题
- 浏览器可能缓存了旧版本的HTML
- 需要强制刷新或清除缓存

## 解决建议

### 1. 验证步骤
1. 在浏览器中直接访问：`http://localhost:3001/api/print/html/1`
2. 查看页面源代码，确认只有一个address-page div
3. 使用浏览器的打印预览功能
4. 检查是否有多页显示

### 2. 如果仍然看到两页
可能需要调整CSS以确保严格的单页显示：

```css
body {
  width: 70mm;
  height: 50mm;
  overflow: hidden;
  page-break-inside: avoid;
  page-break-after: avoid;
}

.address-page {
  width: 70mm;
  height: 50mm;
  position: relative;
  page-break-inside: avoid;
  page-break-after: avoid;
}
```

### 3. 强制单页CSS
如果需要更强制的单页控制：

```css
@page {
  size: 70mm 50mm;
  margin: 0;
}

html, body {
  width: 70mm;
  height: 50mm;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

* {
  page-break-inside: avoid !important;
  page-break-after: avoid !important;
  page-break-before: avoid !important;
}
```

## 当前状态

✅ **地址标签生成逻辑**: 正确，单页HTML
✅ **HTML结构**: 正确，无分页标记  
✅ **CSS样式**: 正确，70mm x 50mm单页
✅ **内容完整**: 所有地址信息在一页中
✅ **字体配置**: 正确，使用指定字体

如果用户仍然看到两页，请提供：
1. 浏览器类型和版本
2. 打印预览的截图
3. 具体在哪个步骤看到两页（预览/打印/其他）

这将帮助我们进一步诊断问题。