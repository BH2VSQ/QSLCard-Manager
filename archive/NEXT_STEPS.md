# 下一步开发指南

## 🎯 当前状态

项目已完成 **85%**，所有前端页面已实现并可正常使用。

---

## 📋 待完成功能

### 1. PDF 生成服务（优先级：高）⭐⭐⭐

#### 需要实现的文件
- `server/services/pdfGenerator.js` - PDF 生成核心服务

#### 功能需求

##### QSL 标签 Layout 1 (TC - 发卡)
- 70x50mm 标签纸
- 6x6 网格布局
- 每个格子包含：
  - QSO 日期、时间
  - 呼号
  - 频率、波段、模式
  - RST 信号报告
- 第 5 列包含小二维码（QSL ID）
- 整页底部包含大二维码（QSL ID）

##### QSL 标签 Layout 2 (RC - 收卡)
- 70x50mm 标签纸
- 单页布局
- 中央大二维码（QSL ID）
- 无其他内容

##### 地址标签
- 两页布局
  - P1: 发件人信息
  - P2: 收件人信息
- 智能分行（自动换行）
- 支持中文字体

#### 技术实现

```javascript
// server/services/pdfGenerator.js

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 注册字体
registerFont(path.join(__dirname, '../../MapleMonoNL-Regular.ttf'), { 
  family: 'MapleMono' 
});
registerFont(path.join(__dirname, '../../Cinese.ttf'), { 
  family: 'Chinese' 
});

/**
 * 生成 QSL 标签
 * @param {string} qslId - QSL ID
 * @param {Array} logs - 日志数组
 * @param {number} layout - 布局类型（1 或 2）
 * @returns {Promise<string>} - PDF 文件路径
 */
export const generateQSLLabel = async (qslId, logs, layout) => {
  const doc = new PDFDocument({
    size: [200, 141.73], // 70x50mm in points (1mm = 2.83465 points)
    margin: 10
  });

  const filename = `qsl_${qslId}_${Date.now()}.pdf`;
  const filepath = path.join(__dirname, '../../temp', filename);
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  if (layout === 1) {
    // Layout 1: 6x6 grid + QR codes
    await generateLayout1(doc, qslId, logs);
  } else {
    // Layout 2: Single QR code
    await generateLayout2(doc, qslId);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(`/temp/${filename}`));
    stream.on('error', reject);
  });
};

/**
 * 生成地址标签
 * @param {Object} sender - 发件人信息
 * @param {Object} receiver - 收件人信息
 * @returns {Promise<string>} - PDF 文件路径
 */
export const generateAddressLabel = async (sender, receiver) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50
  });

  const filename = `address_${Date.now()}.pdf`;
  const filepath = path.join(__dirname, '../../temp', filename);
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  // Page 1: Sender
  doc.font('Chinese')
     .fontSize(16)
     .text('发件人', { align: 'center' });
  
  doc.moveDown();
  doc.fontSize(12)
     .text(sender.name)
     .text(sender.address)
     .text(`${sender.postal_code} ${sender.country}`);

  // Page 2: Receiver
  doc.addPage();
  doc.font('Chinese')
     .fontSize(16)
     .text('收件人', { align: 'center' });
  
  doc.moveDown();
  doc.fontSize(12)
     .text(receiver.name)
     .text(receiver.address)
     .text(`${receiver.postal_code} ${receiver.country}`);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(`/temp/${filename}`));
    stream.on('error', reject);
  });
};

// 辅助函数
async function generateLayout1(doc, qslId, logs) {
  // TODO: 实现 6x6 网格布局
  // 1. 绘制网格
  // 2. 填充 QSO 数据
  // 3. 添加小二维码（第5列）
  // 4. 添加大二维码（底部）
}

async function generateLayout2(doc, qslId) {
  // TODO: 实现单页二维码布局
  // 1. 生成二维码
  // 2. 居中显示
}

async function generateQRCode(text, size = 200) {
  return await QRCode.toDataURL(text, {
    width: size,
    margin: 1
  });
}
```

#### 集成到打印路由

更新 `server/routes/print.js`：

```javascript
import { generateQSLLabel, generateAddressLabel } from '../services/pdfGenerator.js';

// 在 POST /api/print/generate/:queue_id 中
const item = printQueue.find(q => q.id === queueId);

if (item.type === 'qsl_label') {
  // 获取日志数据
  const logs = db.prepare(`
    SELECT l.* FROM logs l
    JOIN qsl_log_link ll ON l.id = ll.log_id
    WHERE ll.qsl_id = ?
  `).all(item.qsl_id);

  const pdfPath = await generateQSLLabel(item.qsl_id, logs, item.layout);
  item.pdf_path = pdfPath;
} else if (item.type === 'address_label') {
  const pdfPath = await generateAddressLabel(item.sender, item.receiver);
  item.pdf_path = pdfPath;
}
```

---

### 2. ADIF 导入/导出（优先级：高）⭐⭐⭐

#### 需要实现的功能

##### ADIF 导入
- 文件上传处理（multer）
- ADIF 解析（adif-parser-ts 或自定义解析器）
- 智能去重（5分钟窗口）
- 合并重复记录
- 自动按时间排序

##### ADIF 导出
- 选择日志导出
- 生成 .adi 文件
- 包含所有 ADIF 字段

#### 技术实现

更新 `server/routes/logs.js`：

```javascript
import multer from 'multer';
import { parseADIF } from 'adif-parser-ts'; // 或自定义解析器

// 配置文件上传
const upload = multer({ 
  dest: 'temp/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * 导入 ADIF
 * POST /api/logs/import
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // 读取文件
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    
    // 解析 ADIF
    const records = parseADIF(fileContent);
    
    let importedCount = 0;
    let duplicateCount = 0;

    for (const record of records) {
      // 检查重复（5分钟窗口）
      const isDuplicate = checkDuplicate(record);
      
      if (isDuplicate) {
        duplicateCount++;
        continue;
      }

      // 插入日志
      const result = db.prepare(`
        INSERT INTO logs (
          station_callsign, qso_date, time_on, freq, band, mode,
          rst_sent, rst_rcvd, my_callsign, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.call,
        record.qso_date,
        record.time_on,
        record.freq,
        record.band,
        record.mode,
        record.rst_sent,
        record.rst_rcvd,
        record.station_callsign,
        record.comment
      );

      if (result.changes > 0) {
        importedCount++;
      }
    }

    // 自动重排序
    reorderLogs();

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        imported_count: importedCount,
        duplicate_count: duplicateCount,
        total_count: records.length
      }
    });
  } catch (error) {
    console.error('Import ADIF error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 导出 ADIF
 * GET /api/logs/export?ids=1,2,3
 */
router.get('/export', (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ success: false, error: 'No IDs provided' });
    }

    const idArray = ids.split(',').map(id => parseInt(id));
    
    // 获取日志
    const logs = db.prepare(`
      SELECT * FROM logs WHERE id IN (${idArray.map(() => '?').join(',')})
    `).all(...idArray);

    // 生成 ADIF 内容
    let adifContent = 'ADIF Export from QSL Manager\n';
    adifContent += '<ADIF_VER:5>3.1.0\n';
    adifContent += '<PROGRAMID:11>QSL Manager\n';
    adifContent += '<EOH>\n\n';

    for (const log of logs) {
      adifContent += `<CALL:${log.station_callsign.length}>${log.station_callsign}\n`;
      adifContent += `<QSO_DATE:8>${log.qso_date}\n`;
      adifContent += `<TIME_ON:4>${log.time_on}\n`;
      adifContent += `<FREQ:${log.freq.toString().length}>${log.freq}\n`;
      adifContent += `<BAND:${log.band.length}>${log.band}\n`;
      adifContent += `<MODE:${log.mode.length}>${log.mode}\n`;
      adifContent += `<RST_SENT:${log.rst_sent.length}>${log.rst_sent}\n`;
      adifContent += `<RST_RCVD:${log.rst_rcvd.length}>${log.rst_rcvd}\n`;
      if (log.my_callsign) {
        adifContent += `<STATION_CALLSIGN:${log.my_callsign.length}>${log.my_callsign}\n`;
      }
      if (log.notes) {
        adifContent += `<COMMENT:${log.notes.length}>${log.notes}\n`;
      }
      adifContent += '<EOR>\n\n';
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="qso_export_${Date.now()}.adi"`);
    res.send(adifContent);
  } catch (error) {
    console.error('Export ADIF error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

### 3. 测试（优先级：中）⭐⭐

#### 单元测试
- 测试工具类（QSL ID 生成器、频率转换）
- 测试 API 路由
- 测试数据库操作

#### 集成测试
- 测试完整的业务流程
- 测试 API 端到端

#### E2E 测试
- 使用 Playwright 或 Cypress
- 测试用户操作流程

---

### 4. 性能优化（优先级：低）⭐

- 数据库查询优化
- 前端代码分割
- 图片懒加载
- 缓存策略
- 打包优化

---

## 🚀 快速开始

### 启动项目

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问应用
# 前端: http://localhost:3000
# 后端: http://localhost:3001
```

### 测试功能

1. **仪表板** - 查看统计数据
2. **日志管理** - 添加、编辑、删除日志
3. **日志编辑器** - 测试 4 种通联类型和连续模式
4. **地址库** - 添加地址
5. **地址标签** - 测试自动填充
6. **出入库** - 测试扫码功能
7. **设置** - 添加呼号、切换主题

---

## 📚 参考资料

### PDF 生成
- [PDFKit 文档](http://pdfkit.org/)
- [node-canvas 文档](https://github.com/Automattic/node-canvas)
- [qrcode 文档](https://github.com/soldair/node-qrcode)

### ADIF 格式
- [ADIF 规范](https://adif.org/)
- [adif-parser-ts](https://www.npmjs.com/package/adif-parser-ts)

### 测试
- [Jest 文档](https://jestjs.io/)
- [Playwright 文档](https://playwright.dev/)

---

## 💡 开发建议

1. **PDF 生成**
   - 先实现简单的布局
   - 逐步添加复杂功能
   - 测试中文字体显示
   - 优化二维码生成

2. **ADIF 导入/导出**
   - 先实现基础字段
   - 逐步支持更多字段
   - 测试各种 ADIF 文件格式
   - 处理边界情况

3. **测试**
   - 从单元测试开始
   - 逐步添加集成测试
   - 最后添加 E2E 测试

4. **性能优化**
   - 使用 Chrome DevTools 分析性能
   - 优化数据库查询
   - 使用 React.memo 优化组件
   - 实现虚拟滚动（大数据量）

---

## 🎯 里程碑

- [x] M1: 项目初始化（已完成）
- [x] M2: 核心功能（已完成）
- [ ] M3: 完整功能（进行中 - 85%）
  - [x] 所有页面完成
  - [ ] PDF 生成
  - [ ] ADIF 导入/导出
- [ ] M4: 测试与发布（待开始）
  - [ ] 单元测试
  - [ ] 集成测试
  - [ ] E2E 测试
  - [ ] 性能优化
  - [ ] 文档完善
  - [ ] v1.0.0 发布

---

**最后更新：2024-12-13**
**当前版本：0.85.0-beta**

**73! Good luck with your QSL Card Manager! 📻**
