# 打印系统调试修复

## 发现的问题

### 1. 前端URL路径问题
- **问题**: 使用相对路径 `/api/print/html/${queueId}` 可能无法正确路由到后端
- **修复**: 使用完整的API URL `${apiURL}/print/html/${queueId}`
- **文件**: `src/pages/PrintQueue.jsx`

### 2. 错误处理不够详细
- **问题**: 错误信息不够具体，难以调试
- **修复**: 添加详细的错误信息和HTTP状态码
- **改进**: 添加弹窗阻止检测

### 3. HTML生成中的CSS Grid问题
- **问题**: 使用了无效的CSS Grid行号 `${rowIndex + 0.5}`
- **修复**: 移除无效的小数行号，使用margin-top替代
- **文件**: `server/services/printService.js`

### 4. 复杂HTML结构可能导致错误
- **问题**: 原始的6x6网格HTML结构过于复杂，可能有语法错误
- **修复**: 创建简化版本的HTML模板用于测试
- **策略**: 先确保基本功能工作，再逐步完善

## 修复内容

### 前端修复 (`src/pages/PrintQueue.jsx`)
```javascript
// 修复前
const response = await fetch(`/api/print/html/${queueId}`);

// 修复后
const apiURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const response = await fetch(`${apiURL}/print/html/${queueId}`);

// 添加详细错误处理
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}

// 添加弹窗检测
const printWindow = window.open('', '_blank');
if (!printWindow) {
  throw new Error('无法打开打印窗口，请检查浏览器弹窗设置');
}
```

### 后端修复 (`server/services/printService.js`)
```javascript
// 添加错误处理和日志
export const generateQSLPrintHTML = async (qslId, logs, layout) => {
  try {
    console.log(`Generating QSL HTML: ${qslId}, layout: ${layout}, logs: ${logs.length}`);
    // ... 生成逻辑
  } catch (error) {
    console.error('Error generating QSL HTML:', error);
    // 返回简单的测试HTML
    return testHTML;
  }
};

// 简化HTML模板
async function generateLayout1HTML(qslId, logs) {
  // 使用简单的布局而不是复杂的CSS Grid
  return simpleHTML;
}
```

### 后端路由修复 (`server/routes/print.js`)
```javascript
// 添加详细日志
router.get('/html/:queue_id', async (req, res) => {
  console.log(`Getting HTML for queue ID: ${queueId}`);
  console.log(`Found queue item:`, item);
  console.log(`Generated HTML content length: ${htmlContent.length}`);
  // ...
});
```

## 测试步骤

1. **检查后端日志**: 查看控制台输出，确认HTML生成过程
2. **测试API端点**: 直接访问 `http://localhost:3001/api/print/html/1` 查看HTML输出
3. **检查浏览器控制台**: 查看前端错误信息
4. **测试弹窗设置**: 确保浏览器允许弹窗

## 预期结果

- 点击打印按钮后应该能打开新窗口
- 新窗口显示简化的QSL标签内容
- 自动触发浏览器打印对话框
- 控制台显示详细的调试信息

## 下一步

如果简化版本工作正常，再逐步恢复完整的6x6网格布局。