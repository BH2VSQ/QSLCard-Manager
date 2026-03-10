import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '../../temp');

// 确保临时目录存在
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 中文字体支持
let chineseFontLoaded = false;
const loadChineseFont = (doc) => {
  if (!chineseFontLoaded) {
    try {
      // 尝试加载中文字体文件
      const fontPath = path.join(__dirname, '../../Cinese.ttf');
      const fontPath2 = path.join(__dirname, '../../MapleMonoNL-Regular.ttf');
      
      if (fs.existsSync(fontPath)) {
        const fontData = fs.readFileSync(fontPath);
        doc.addFileToVFS('Cinese.ttf', fontData.toString('base64'));
        doc.addFont('Cinese.ttf', 'Cinese', 'normal');
      }
      
      if (fs.existsSync(fontPath2)) {
        const fontData2 = fs.readFileSync(fontPath2);
        doc.addFileToVFS('MapleMonoNL-Regular.ttf', fontData2.toString('base64'));
        doc.addFont('MapleMonoNL-Regular.ttf', 'MapleMonoNL', 'normal');
      }
      
      chineseFontLoaded = true;
    } catch (error) {
      console.warn('Chinese font loading failed, using default font:', error.message);
    }
  }
};

// 混合字符串绘制函数（支持中英文）
const drawMixedString = (doc, x, y, text, fontSize, align = 'left') => {
  if (!text) text = '';
  text = String(text);
  
  // 检测是否包含中文
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  
  if (hasChinese && chineseFontLoaded) {
    doc.setFont('Cinese', 'normal');
  } else {
    doc.setFont('helvetica', 'normal');
  }
  
  doc.setFontSize(fontSize);
  
  if (align === 'center') {
    const textWidth = doc.getTextWidth(text);
    x = x - (textWidth / 2);
  }
  
  doc.text(text, x, y);
};

/**
 * 生成 QSL 标签
 * @param {string} qslId - QSL ID
 * @param {Array} logs - 日志数组
 * @param {number} layout - 布局类型（1 或 2）
 * @returns {Promise<string>} - PDF 文件路径
 */
export const generateQSLLabel = async (qslId, logs, layout) => {
  const filename = `qsl_${qslId}_${Date.now()}.pdf`;
  const filepath = path.join(TEMP_DIR, filename);

  try {
    // 70x50mm = 198.43 x 141.73 points
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: [198.43, 141.73]
    });

    // 加载中文字体
    loadChineseFont(doc);

    if (layout === 1) {
      // Layout 1: 6x6 grid + QR codes (发卡 TC)
      await generateLayout1(doc, qslId, logs);
    } else {
      // Layout 2: Single QR code (收卡 RC)
      await generateLayout2(doc, qslId);
    }

    // 保存 PDF
    const pdfData = doc.output('arraybuffer');
    fs.writeFileSync(filepath, Buffer.from(pdfData));

    return filename;
  } catch (error) {
    console.error('Generate QSL Label error:', error);
    throw error;
  }
};

/**
 * 生成地址标签（单独的发信或收信地址）
 * @param {Object} data - 地址信息
 * @param {string} data.type - 'sender' 或 'receiver'
 * @param {string} data.name - 姓名
 * @param {string} data.phone - 电话
 * @param {string} data.address - 地址
 * @param {string} data.postal_code - 邮编
 * @param {string} data.country - 国家
 * @returns {Promise<string>} - PDF 文件路径
 */
export const generateAddressLabel = async (data) => {
  const filename = `address_${data.type}_${Date.now()}.pdf`;
  const filepath = path.join(TEMP_DIR, filename);

  try {
    // 70x50mm label size
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [70, 50]
    });

    // 加载中文字体
    loadChineseFont(doc);

    // 标题
    const title = data.type === 'sender' ? 'Sender' : 'Receiver';
    drawMixedString(doc, 35, 8, title, 10, 'center');
    
    let y = 15;
    const leftMargin = 5;
    const maxWidth = 60;
    
    // 姓名
    if (data.name) {
      drawMixedString(doc, leftMargin, y, data.name, 8, 'left');
      y += 5;
    }
    
    // 电话
    if (data.phone) {
      drawMixedString(doc, leftMargin, y, `Tel: ${data.phone}`, 8, 'left');
      y += 5;
    }
    
    // 地址
    if (data.address) {
      const addressLines = smartLineBreak(data.address, 40);
      addressLines.forEach(line => {
        if (y < 45) { // 确保不超出标签范围
          drawMixedString(doc, leftMargin, y, line, 8, 'left');
          y += 4;
        }
      });
      y += 2;
    }
    
    // 邮编和国家
    if (data.postal_code || data.country) {
      const location = [data.postal_code, data.country].filter(Boolean).join(' ');
      if (y < 45) {
        drawMixedString(doc, leftMargin, y, location, 8, 'left');
      }
    }

    // 保存 PDF
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(filepath, pdfBuffer);

    return filename;
  } catch (error) {
    console.error('Generate address label error:', error);
    throw error;
  }
};

/**
 * 清空临时文件夹
 */
export const clearTempFolder = () => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
    return { success: true, message: 'Temp folder cleared' };
  } catch (error) {
    console.error('Clear temp folder error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 删除指定的临时文件
 * @param {string} filename - 文件名
 */
export const deleteTempFile = (filename) => {
  try {
    const filePath = path.join(TEMP_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Delete temp file error:', error);
    return { success: false, error: error.message };
  }
};

// ========== 辅助函数 ==========

/**
 * Layout 1: 6x6 网格 + QR 码（发卡 TC）
 * 1-N页：6x6 网格布局的 QSO 数据
 * 最后一页：独立的 QSL ID 和居中二维码
 */
/**
 * Layout 1: 6x6 网格 + QR 码（发卡 TC）
 * 1-N页：6x6 网格布局的 QSO 数据
 * 最后一页：独立的 QSL ID 和居中二维码
 */
async function generateLayout1(doc, qslId, logs) {
  const pageWidth = 198.43;  // 70mm in points
  const pageHeight = 141.73; // 50mm in points
  const ROWS = 6;
  const COLS = 6;
  const colWidth = pageWidth / COLS;
  const rowHeight = pageHeight / ROWS;
  const halfRowHeight = rowHeight / 2;

  // QR Code 配置（匹配Python设置）
  const QR_SIZE = 28.35; // 10mm in points
  const QR_Y_OFFSET = 48.19; // 17mm in points
  const QR_PAGE_SIZE = 99.21; // 35mm in points
  const QR_PAGE_Y_OFFSET = 14.17; // 5mm in points

  // 辅助函数：获取单元格中心坐标
  function getCellCenter(r, c, subRow = null) {
    let x = (c * colWidth) + (colWidth / 2);
    let y;

    if (subRow === null || r < 2 || r > 5) {
      // 正常单元格（行 0, 1）
      y = pageHeight - (r * rowHeight) - (rowHeight / 2) - 2.83; // -1mm
    } else {
      // 分割单元格（行 2-5）
      const yBottom = pageHeight - ((r + 1) * rowHeight);
      if (subRow === 0) {
        // 上半部分
        y = yBottom + 1.5 * halfRowHeight - 2.83;
      } else {
        // 下半部分
        y = yBottom + 0.5 * halfRowHeight - 2.83;
      }
    }
    return { x, y };
  }

  // 生成 QSO 数据页（每页4条日志）
  const logsPerPage = 4;
  const logChunks = [];
  for (let i = 0; i < logs.length; i += logsPerPage) {
    logChunks.push(logs.slice(i, i + logsPerPage));
  }

  for (let pageNum = 0; pageNum < logChunks.length; pageNum++) {
    if (pageNum > 0) doc.addPage();

    const chunk = logChunks[pageNum];
    const firstLog = chunk[0];
    const toRadio = firstLog.station_callsign || '';

    // Row 0: Header
    drawMixedString(doc, 5.67, pageHeight - rowHeight + 7.09, 'To Radio:', 14, 'left');

    const headerWidth = doc.getTextWidth('To Radio:');
    drawMixedString(doc, 5.67 + headerWidth, pageHeight - rowHeight + 7.09, toRadio, 10, 'left');

    // PSE QSL TNX (Col 4-5)
    const psePos = getCellCenter(0, 4.5);
    drawMixedString(doc, psePos.x, psePos.y, 'PSE QSL TNX', 7, 'center');

    // Row 1: Column Headers
    const headers = ['Date', 'UTC', 'RST', 'MHz', 'Mode'];
    const headerCols = [0, 1, 2, 3, 4];

    headers.forEach((text, idx) => {
      const pos = getCellCenter(1, headerCols[idx]);
      drawMixedString(doc, pos.x, pos.y, text, 7, 'center');
    });

    // 表头下方横线
    const lineY = pageHeight - (2 * rowHeight);
    doc.setLineWidth(0.5);
    doc.line(2.83, lineY, 5 * colWidth, lineY); // 1mm to Col 5 left edge

    // Rows 2-5: QSO Data
    for (let i = 0; i < chunk.length && i < 4; i++) {
      const currentRow = 2 + i;
      const log = chunk[i];

      // 格式化日期
      let formattedDate = log.qso_date || '';
      if (formattedDate.length === 8) {
        const day = formattedDate.slice(6, 8);
        const month = formattedDate.slice(4, 6);
        const year = formattedDate.slice(0, 4);
        formattedDate = `${day}.${month}.${year}`;
      }

      // 基础数据
      const baseData = [
        formattedDate,
        (log.time_on || '').toString().slice(0, 4),
        log.rst_rcvd || '',
        log.mode || ''
      ];
      const baseCols = [0, 1, 2, 4];

      baseData.forEach((text, idx) => {
        const pos = getCellCenter(currentRow, baseCols[idx], 0);
        const fontSize = text.length > 7 ? 5 : 6;
        drawMixedString(doc, pos.x, pos.y, text.toString(), fontSize, 'center');
      });

      // 频率判定逻辑（完全匹配Python）
      let freqDisplay = '';
      if (log.sat_name) {
        const freqRx = parseFloat(log.freq_rx || 0);
        const freqTx = parseFloat(log.freq || 0);

        if (freqRx > 400 && freqRx < 500 && freqTx > 140 && freqTx < 150) {
          freqDisplay = '145/435';
        } else if (freqRx > 140 && freqRx < 150 && freqTx > 400 && freqTx < 500) {
          freqDisplay = '435/145';
        } else if (freqRx > 400 && freqRx < 500 && freqTx > 400 && freqTx < 500) {
          freqDisplay = '435/435';
        } else if (freqRx > 140 && freqRx < 150 && freqTx > 140 && freqTx < 150) {
          freqDisplay = '145/145';
        } else {
          freqDisplay = `${log.freq || ''}/${log.freq_rx || ''}`;
        }
      } else if (log.mode === 'EYEBALL') {
        freqDisplay = 'N/A';
      } else {
        freqDisplay = (log.freq || '').toString().slice(0, 7);
      }

      const freqPos = getCellCenter(currentRow, 3, 0);
      drawMixedString(doc, freqPos.x, freqPos.y, freqDisplay, 7, 'center');

      // 下半部分：备注和卫星信息
      const bottomPos = getCellCenter(currentRow, 0, 1);

      let commentText = '';
      let infoText = '';

      if (log.comment) {
        commentText = `备注: ${log.comment.slice(0, 25)}`;
      }

      if (log.sat_name) {
        infoText = `Satellite: via ${log.sat_name}`;
      } else if (log.mode === 'EYEBALL') {
        infoText = `Type: ${log.submode || ''}`;
      }

      if (commentText) {
        drawMixedString(doc, 0.5 * colWidth, bottomPos.y, commentText, 6, 'left');
        if (infoText) {
          const commentWidth = doc.getTextWidth(commentText);
          drawMixedString(doc, 0.5 * colWidth + commentWidth + 8.5, bottomPos.y, infoText, 6, 'left');
        }
      } else if (infoText) {
        drawMixedString(doc, 0.5 * colWidth, bottomPos.y, infoText, 6, 'left');
      }

      // 分隔线
      if (currentRow < 5) {
        const lineYQso = pageHeight - ((currentRow + 1) * rowHeight);
        doc.setLineWidth(0.2);
        doc.line(2.83, lineYQso, 5 * colWidth, lineYQso);
      }
    }

    // Col 5 QR Code (Rows 1-5)
    try {
      const qrDataUrl = await QRCode.toDataURL(qslId, {
        errorCorrectionLevel: 'H',
        width: 200,
        margin: 0
      });

      const qrAreaXStart = 5 * colWidth;
      const qrAreaYBottom = pageHeight - (6 * rowHeight);
      const qrAreaHeight = 5 * rowHeight;
      const qrAreaWidth = colWidth;

      const centerX = qrAreaXStart + (qrAreaWidth / 2);
      const centerY = qrAreaYBottom + (qrAreaHeight / 2) + QR_Y_OFFSET;

      const drawX = centerX - (QR_SIZE / 2);
      const drawY = centerY - (QR_SIZE / 2);

      doc.addImage(qrDataUrl, 'PNG', drawX, drawY, QR_SIZE, QR_SIZE);
    } catch (error) {
      console.error('QR code generation error:', error);
    }
  }

  // 最后一页：QSL ID + 大二维码
  doc.addPage();

  try {
    const qrDataUrl = await QRCode.toDataURL(qslId, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 0
    });

    const centerX = pageWidth / 2;
    const centerY = pageHeight / 2 + QR_PAGE_Y_OFFSET;

    const drawX = centerX - (QR_PAGE_SIZE / 2);
    const drawY = centerY - (QR_PAGE_SIZE / 2);

    doc.addImage(qrDataUrl, 'PNG', drawX, drawY, QR_PAGE_SIZE, QR_PAGE_SIZE);

    // QSL ID 文本
    const textY = centerY + (QR_PAGE_SIZE / 2) - 127.56; // -45mm
    drawMixedString(doc, centerX, textY, qslId, 12, 'center');
  } catch (error) {
    console.error('Final page QR code generation error:', error);
  }
}


/**
 * Layout 2: 单页二维码（收卡 RC）
 * 仅生成 QSL ID 二维码页
 */
/**
 * Layout 2: 单页二维码（收卡 RC）
 * 仅生成 QSL ID 二维码页
 */
async function generateLayout2(doc, qslId) {
  const pageWidth = 198.43;  // 70mm in points
  const pageHeight = 141.73; // 50mm in points
  const QR_PAGE_SIZE = 99.21; // 35mm in points
  const QR_PAGE_Y_OFFSET = 14.17; // 5mm in points

  try {
    // 生成大二维码
    const qrDataUrl = await QRCode.toDataURL(qslId, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 0
    });

    // 计算中心位置
    const centerX = pageWidth / 2;
    const centerY = pageHeight / 2 + QR_PAGE_Y_OFFSET;

    // 绘制二维码
    const drawX = centerX - (QR_PAGE_SIZE / 2);
    const drawY = centerY - (QR_PAGE_SIZE / 2);

    doc.addImage(qrDataUrl, 'PNG', drawX, drawY, QR_PAGE_SIZE, QR_PAGE_SIZE);

    // 绘制 ID 文本（居中在二维码下方）
    const textY = centerY + (QR_PAGE_SIZE / 2) - 127.56; // -45mm
    drawMixedString(doc, centerX, textY, qslId, 12, 'center');
  } catch (error) {
    console.error('QR code generation error:', error);
  }
}


/**
 * 智能分行
 * @param {string} text - 文本
 * @param {number} maxLength - 每行最大字符数
 * @returns {Array<string>} - 分行后的文本数组
 */
function smartLineBreak(text, maxLength = 50) {
  if (!text) return [];
  
  const lines = [];
  const parts = text.split(/[,，\n]/);
  
  let currentLine = '';
  
  parts.forEach(part => {
    const trimmedPart = part.trim();
    if (!trimmedPart) return;
    
    if (currentLine.length + trimmedPart.length + 1 <= maxLength) {
      currentLine += (currentLine ? ', ' : '') + trimmedPart;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = trimmedPart;
    }
  });
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return '';
  const str = date.toString();
  return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
}

/**
 * 格式化时间
 */
function formatTime(time) {
  if (!time) return '';
  const str = time.toString().padStart(4, '0');
  return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
}

export default {
  generateQSLLabel,
  generateAddressLabel,
  clearTempFolder,
  deleteTempFile
};
