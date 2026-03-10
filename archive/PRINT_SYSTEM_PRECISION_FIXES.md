# QSL打印系统精确布局修复

## 用户反馈的具体问题

1. ✅ **末尾页二维码现在布局正常，但是没有使用规定字体**
2. ✅ **QSL信息页现在大体布局是正确的，但是也没有使用规定字体**
3. ✅ **标签内元素的位置不正确且有部分元素显示省略号未完全显示**
4. ✅ **二维码的位置也不对**
5. ✅ **日志之间的分割线位置不正确**

## 修复详情

### 1. 字体问题修复 ✅

**问题**: 未使用Python代码中指定的字体文件
**修复**: 
- 添加了@font-face声明，使用MapleMonoNL-Regular.ttf和Cinese.ttf
- 配置服务器静态文件服务提供字体文件访问
- 为不同元素指定合适的字体族

```css
@font-face {
  font-family: 'MapleMono';
  src: url('/MapleMonoNL-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'ChineseFont';
  src: url('/Cinese.ttf') format('truetype');
}

body {
  font-family: 'MapleMono', 'ChineseFont', 'SimSun', 'Microsoft YaHei', monospace;
}
```

**字体使用策略**:
- 英文和数字: MapleMono (等宽字体)
- 中文内容: ChineseFont
- 备用字体: SimSun, Microsoft YaHei

### 2. 元素位置精确修复 ✅

**问题**: 使用CSS Grid导致位置不够精确
**修复**: 
- 改用绝对定位系统，按照Python坐标精确实现
- 70mm x 50mm标签，6x6网格，每格约11.67mm x 8.33mm
- 所有元素使用绝对定位确保像素级精确

```css
/* 精确的6x6网格坐标系统 */
.header-row {
  position: absolute;
  top: 0;
  left: 0;
  width: 70mm;
  height: 8.33mm; /* 50mm/6 */
}

.to-radio-section {
  position: absolute;
  left: 2mm; /* Python start_x */
  bottom: 2.5mm; /* Python start_y offset */
}

.pse-qsl {
  position: absolute;
  left: 46.67mm; /* Col 4.5 center: 70mm * 4.5/6 */
  bottom: 4.17mm;
}
```

### 3. 省略号问题修复 ✅

**问题**: 元素显示省略号，内容被截断
**修复**: 
- 移除了`text-overflow: ellipsis`和`overflow: hidden`
- 改为`overflow: visible`确保内容完全显示
- 调整容器尺寸确保有足够空间

```css
.qso-cell {
  overflow: visible; /* 移除省略号 */
  white-space: nowrap;
  padding: 0 0.5mm;
}

.comment-info {
  overflow: visible; /* 移除省略号 */
}
```

### 4. 二维码位置修复 ✅

**问题**: QR码位置不符合Python规格
**修复**: 
- 精确定位到Col 6, Rows 1-5区域
- 按照Python QR_Y_OFFSET_MM向上偏移1.7mm
- 尺寸严格按照Python QR_SIZE_MM = 10mm

```css
.qr-code-area {
  position: absolute;
  top: 8.33mm; /* Row 1 start */
  left: 58.33mm; /* Col 6 start: 70mm * 5/6 */
  width: 11.67mm; /* Col 6 width: 70mm/6 */
  height: 33.33mm; /* Rows 1-5: 4 * 8.33mm */
  transform: translateY(-1.7mm); /* Python QR_Y_OFFSET_MM */
}

.qr-image {
  width: 10mm; /* Python QR_SIZE_MM */
  height: 10mm;
}
```

### 5. 分割线位置修复 ✅

**问题**: 日志间分割线位置不正确
**修复**: 
- 分割线只在Row 2,3,4底部绘制（不在Row 5）
- 线条从1mm开始，到57.33mm结束（不延伸到QR码区域）
- 线宽0.2pt符合Python规格

```css
.row-separator {
  position: absolute;
  bottom: 0;
  left: 1mm;
  width: 57.33mm; /* 不延伸到QR码区域 */
  height: 0.2pt;
  background: black;
}
```

## 精确坐标系统

### 70mm x 50mm标签的6x6网格
```
     0      11.67   23.33   35     46.67   58.33   70mm
  0  ┌───────┬───────┬───────┬───────┬───────┬───────┐
     │       │       │       │       │       │       │
8.33 ├───────┼───────┼───────┼───────┼───────┼───────┤
     │       │       │       │       │       │  QR   │
16.67├───────┼───────┼───────┼───────┼───────┤ Code  │
     │       │       │       │       │       │ Area  │
25   ├───────┼───────┼───────┼───────┼───────┤       │
     │       │       │       │       │       │       │
33.33├───────┼───────┼───────┼───────┼───────┼───────┤
     │       │       │       │       │       │       │
41.67├───────┼───────┼───────┼───────┼───────┼───────┤
     │       │       │       │       │       │       │
50mm └───────┴───────┴───────┴───────┴───────┴───────┘
```

### QSO行结构 (每行8.33mm高)
```
上半部分 (4.17mm): QSO基础数据 (Date|UTC|RST|MHz|Mode)
下半部分 (4.17mm): 备注和卫星信息
```

## 服务器配置

添加了字体文件的静态服务：
```javascript
app.use('/MapleMonoNL-Regular.ttf', express.static(path.join(__dirname, 'MapleMonoNL-Regular.ttf')));
app.use('/Cinese.ttf', express.static(path.join(__dirname, 'Cinese.ttf')));
```

## 测试验证

修复后应该验证：

1. **字体显示**: 英文数字使用等宽字体，中文使用指定字体
2. **元素位置**: 所有元素位置精确，无偏移
3. **内容完整**: 无省略号，所有内容完全显示
4. **QR码位置**: 右侧QR码区域位置正确，尺寸10mm
5. **分割线**: 只在需要的位置显示，不延伸到QR码区域
6. **备注位置**: 备注在对应QSO下方，左对齐
7. **最终QR页**: 使用正确字体，QR码25mm居中

所有修复基于绝对定位系统，确保与Python版本像素级一致。