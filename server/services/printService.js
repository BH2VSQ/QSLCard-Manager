import QRCode from 'qrcode';

/**
 * 生成QSL标签的HTML打印内容 - 完全基于Python main.py的精确布局
 * @param {string} qslId - QSL ID
 * @param {Array} logs - 日志数组
 * @param {number} layout - 布局类型（1 或 2）
 * @returns {Promise<string>} - HTML内容
 */
export const generateQSLPrintHTML = async (qslId, logs, layout) => {
  try {
    console.log(`Generating QSL HTML: ${qslId}, layout: ${layout}, logs: ${logs.length}`);
    
    if (layout === 1) {
      return await generateLayout1HTML(qslId, logs);
    } else {
      return await generateLayout2HTML(qslId);
    }
  } catch (error) {
    console.error('Error generating QSL HTML:', error);
    throw error;
  }
};

/**
 * 生成地址标签的HTML打印内容 - 单页格式，不分页
 * 每次打印一张70mm x 50mm标签，包含完整的发信或收信地址
 * @param {Object} data - 地址信息，可以是单个地址或包含sender/receiver
 * @returns {string} - HTML内容
 */
export const generateAddressPrintHTML = (data) => {
  // 智能地址分行函数（优化版本，限制行数防止分页）
  const smartSplitAddress = (rawAddr) => {
    if (!rawAddr) return [];
    
    if (rawAddr.includes('|')) {
      const lines = rawAddr.split('|').map(line => line.trim()).filter(line => line);
      // 限制最多3行地址，防止超出页面高度
      return lines.slice(0, 3);
    }

    const lines = [];
    let currentLine = '';
    const coreKeywords = ['省', '市', '州', '县', '区'];
    const maxLen = 20; // 增加单行长度，减少行数
    const minLenForKeywordBreak = 8; // 增加最小长度，减少不必要的换行
    
    // 清理空格和制表符
    rawAddr = rawAddr.replace(/ /g, '').replace(/\t/g, '');
    
    let i = 0;
    while (i < rawAddr.length && lines.length < 3) { // 限制最多3行
      const char = rawAddr[i];
      currentLine += char;
      i++;
      
      const currentLen = currentLine.length;

      // 规则A: 关键词触发的换行（但要考虑行数限制）
      if (currentLen >= minLenForKeywordBreak && lines.length < 2) { // 只在前2行应用关键词换行
        let isKeywordEnd = false;
        for (const kw of coreKeywords) {
          if (currentLine.endsWith(kw)) {
            isKeywordEnd = true;
            break;
          }
        }
        
        if (isKeywordEnd) {
          lines.push(currentLine);
          currentLine = '';
          continue;
        }
      }

      // 规则B: 长度强制截断
      if (currentLen >= maxLen) {
        lines.push(currentLine.substring(0, maxLen));
        currentLine = currentLine.substring(maxLen);
        i = i - currentLine.length;
      }
    }

    if (currentLine && lines.length < 3) {
      lines.push(currentLine);
    }
    
    // 如果还有剩余内容但已达到行数限制，将其合并到最后一行
    if (currentLine && lines.length === 3) {
      lines[2] = lines[2] + currentLine;
      // 截断过长的最后一行
      if (lines[2].length > 25) {
        lines[2] = lines[2].substring(0, 25) + '...';
      }
    }
    
    return lines.filter(line => line);
  };

  // 确定要打印的地址信息和标题
  let addressInfo, roleTitle;
  
  // 修复：安全地检查数据结构
  if (data && typeof data === 'object') {
    if (data.sender && (data.sender.name || data.sender.address)) {
      addressInfo = data.sender;
      roleTitle = 'FROM(发自)';
    } else if (data.receiver && (data.receiver.name || data.receiver.address)) {
      addressInfo = data.receiver;
      roleTitle = 'TO(发往)';
    } else if (data.type) {
      // 兼容直接传递地址数据的情况
      addressInfo = data;
      roleTitle = data.type === 'sender' ? 'FROM(发自)' : 'TO(发往)';
    } else {
      // 默认处理：直接使用传入的数据
      addressInfo = data;
      roleTitle = 'FROM(发自)'; // 默认标题
    }
  } else {
    // 数据无效时的默认处理
    addressInfo = {};
    roleTitle = 'FROM(发自)';
  }

  // 处理字段映射：postal_code -> zip，安全地访问属性
  const normalizedInfo = {
    name: (addressInfo && addressInfo.name) || '',
    address: (addressInfo && addressInfo.address) || '',
    zip: (addressInfo && (addressInfo.zip || addressInfo.postal_code)) || '',
    phone: (addressInfo && addressInfo.phone) || '',
    country: (addressInfo && addressInfo.country) || ''
  };
  
  const addressLines = smartSplitAddress(normalizedInfo.address);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Address Label - ${roleTitle}</title>
      <style>
        ${getAddressLabelCSS()}
      </style>
    </head>
    <body>
      <div class="address-page">
        <div class="address-content">
          <div class="title">${roleTitle}:</div>
          <div class="zip">${normalizedInfo.zip}</div>
          ${addressLines.map(line => `<div class="address-line">${line}</div>`).join('')}
          <div class="name">${normalizedInfo.name}</div>
          ${normalizedInfo.phone ? `<div class="phone">TEL: ${normalizedInfo.phone}</div>` : ''}
          ${normalizedInfo.country ? `<div class="country">${normalizedInfo.country}</div>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * 生成批量地址标签打印HTML
 * @param {Array} addressDataArray - 地址数据数组
 * @returns {string} - 批量HTML内容
 */
export const generateAddressBatchPrintHTML = (addressDataArray) => {
  if (!Array.isArray(addressDataArray) || addressDataArray.length === 0) {
    return '';
  }

  // 智能地址分行函数（复用单个地址标签的逻辑）
  const smartSplitAddress = (rawAddr) => {
    if (!rawAddr) return [];
    
    if (rawAddr.includes('|')) {
      const lines = rawAddr.split('|').map(line => line.trim()).filter(line => line);
      return lines.slice(0, 3);
    }

    const lines = [];
    let currentLine = '';
    const coreKeywords = ['省', '市', '州', '县', '区'];
    const maxLen = 20;
    const minLenForKeywordBreak = 8;
    
    rawAddr = rawAddr.replace(/ /g, '').replace(/\t/g, '');
    
    let i = 0;
    while (i < rawAddr.length && lines.length < 3) {
      const char = rawAddr[i];
      currentLine += char;
      i++;
      
      const currentLen = currentLine.length;

      if (currentLen >= minLenForKeywordBreak && lines.length < 2) {
        let isKeywordEnd = false;
        for (const kw of coreKeywords) {
          if (currentLine.endsWith(kw)) {
            isKeywordEnd = true;
            break;
          }
        }
        
        if (isKeywordEnd) {
          lines.push(currentLine);
          currentLine = '';
          continue;
        }
      }

      if (currentLen >= maxLen) {
        lines.push(currentLine.substring(0, maxLen));
        currentLine = currentLine.substring(maxLen);
        i = i - currentLine.length;
      }
    }

    if (currentLine && lines.length < 3) {
      lines.push(currentLine);
    }
    
    if (currentLine && lines.length === 3) {
      lines[2] = lines[2] + currentLine;
      if (lines[2].length > 25) {
        lines[2] = lines[2].substring(0, 25) + '...';
      }
    }
    
    return lines.filter(line => line);
  };

  // 生成每个地址标签的HTML内容
  const generateSingleAddressContent = (data) => {
    let addressInfo, roleTitle;
    
    if (data && typeof data === 'object') {
      if (data.sender && (data.sender.name || data.sender.address)) {
        addressInfo = data.sender;
        roleTitle = 'FROM(发自)';
      } else if (data.receiver && (data.receiver.name || data.receiver.address)) {
        addressInfo = data.receiver;
        roleTitle = 'TO(发往)';
      } else if (data.type) {
        addressInfo = data;
        roleTitle = data.type === 'sender' ? 'FROM(发自)' : 'TO(发往)';
      } else {
        addressInfo = data;
        roleTitle = 'FROM(发自)';
      }
    } else {
      addressInfo = {};
      roleTitle = 'FROM(发自)';
    }

    const normalizedInfo = {
      name: (addressInfo && addressInfo.name) || '',
      address: (addressInfo && addressInfo.address) || '',
      zip: (addressInfo && (addressInfo.zip || addressInfo.postal_code)) || '',
      phone: (addressInfo && addressInfo.phone) || '',
      country: (addressInfo && addressInfo.country) || ''
    };
    
    const addressLines = smartSplitAddress(normalizedInfo.address);
    
    return `
      <div class="address-page">
        <div class="address-content">
          <div class="title">${roleTitle}:</div>
          <div class="zip">${normalizedInfo.zip}</div>
          ${addressLines.map(line => `<div class="address-line">${line}</div>`).join('')}
          <div class="name">${normalizedInfo.name}</div>
          ${normalizedInfo.phone ? `<div class="phone">TEL: ${normalizedInfo.phone}</div>` : ''}
          ${normalizedInfo.country ? `<div class="country">${normalizedInfo.country}</div>` : ''}
        </div>
      </div>
    `;
  };

  // 生成所有地址标签的内容
  const allAddressContent = addressDataArray.map(generateSingleAddressContent).join('\n');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Batch Address Labels</title>
      <style>
        ${getAddressLabelCSS()}
      </style>
    </head>
    <body>
      ${allAddressContent}
    </body>
    </html>
  `;
};

// 地址标签CSS - 优化批量打印，确保每个标签都能正确显示
function getAddressLabelCSS() {
  return `
    @page {
      size: 70mm 50mm;
      margin: 0;
    }
    
    @font-face {
      font-family: 'MapleMono';
      src: url('/MapleMonoNL-Regular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    
    @font-face {
      font-family: 'ChineseFont';
      src: url('/Cinese.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 70mm;
      height: 50mm;
      margin: 0;
      padding: 0;
      font-family: 'MapleMono', 'ChineseFont', 'SimSun', 'Microsoft YaHei', monospace;
      background: white;
      color: black;
    }
    
    .address-page {
      width: 70mm;
      height: 50mm;
      position: relative;
      /* 移除所有可能阻止分页的样式 */
      display: block;
      clear: both;
    }
    
    .address-content {
      position: absolute;
      top: 6mm;
      left: 3mm;
      right: 3mm;
      bottom: 3mm;
      max-height: 41mm;
      overflow: hidden;
    }
    
    .title {
      font-family: 'MapleMono', 'ChineseFont', monospace;
      font-size: 10pt;
      font-weight: bold;
      margin-bottom: 3mm;
      line-height: 1.1;
    }
    
    .zip {
      font-family: 'MapleMono', monospace;
      font-size: 9pt;
      margin-bottom: 3mm;
      line-height: 1.1;
    }
    
    .address-line {
      font-family: 'ChineseFont', 'MapleMono', monospace;
      font-size: 9pt;
      margin-bottom: 2.5mm;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .name {
      font-family: 'ChineseFont', 'MapleMono', monospace;
      font-size: 10pt;
      font-weight: bold;
      margin-top: 1mm;
      margin-bottom: 3mm;
      line-height: 1.1;
    }
    
    .phone {
      font-family: 'MapleMono', monospace;
      font-size: 8pt;
      margin-bottom: 2mm;
      line-height: 1.1;
    }
    
    .country {
      font-family: 'ChineseFont', 'MapleMono', monospace;
      font-size: 9pt;
      font-weight: bold;
      line-height: 1.1;
    }
    
    @media print {
      html, body {
        width: 70mm !important;
        height: 50mm !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .address-page {
        /* 批量打印时，只防止页面内部分页，允许页面间分页 */
        page-break-inside: avoid !important;
        /* 不设置 page-break-before 和 page-break-after，让分页符自然工作 */
      }
      
      /* 只防止内容元素内部分页 */
      .address-content > * {
        page-break-inside: avoid !important;
      }
    }
  `;
}

/**
 * 生成Layout 1 HTML - 完全按照Python generate_layout_1实现
 * 70mm x 50mm 标签，6x6网格布局，每页4条QSO数据，最后一页独立QR码
 */
async function generateLayout1HTML(qslId, logs) {
  try {
    // 按每页4条日志分组 - 完全按照Python逻辑
    const logsPerPage = 4;
    const logChunks = [];
    for (let i = 0; i < logs.length; i += logsPerPage) {
      logChunks.push(logs.slice(i, i + logsPerPage));
    }

    let pagesHTML = '';

    // 生成QSO数据页（每页4条日志）
    for (let pageIndex = 0; pageIndex < logChunks.length; pageIndex++) {
      const chunk = logChunks[pageIndex];
      const firstLog = chunk[0] || {};
      const toRadio = firstLog.station_callsign || '';

      // 为每页生成QR码 - 按照Python规格
      let qrDataUrl;
      try {
        qrDataUrl = await QRCode.toDataURL(qslId, {
          errorCorrectionLevel: 'H', // QR_ERROR_CORRECTION
          width: 200, // 对应Python QR_BOX_SIZE
          margin: 0,   // QR_BORDER
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        console.log(`Generated QR code for ${qslId}, data URL length: ${qrDataUrl.length}`);
      } catch (qrError) {
        console.error('QR code generation error:', qrError);
        // 生成备用QR码
        qrDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(`
          <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="black"/>
            <text x="100" y="100" text-anchor="middle" fill="white" font-size="12">${qslId}</text>
          </svg>
        `).toString('base64');
      }

      pagesHTML += `
        <div class="qsl-page" ${pageIndex > 0 ? 'style="page-break-before: always;"' : ''}>
          ${generateQSODataPageHTML(toRadio, chunk, qslId, qrDataUrl)}
        </div>
      `;
    }

    // 添加最后的QR码页 - 按照Python第二部分逻辑
    let finalQrDataUrl;
    try {
      finalQrDataUrl = await QRCode.toDataURL(qslId, {
        errorCorrectionLevel: 'H',
        width: 300, // 缩小尺寸对应25mm QR码
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      console.log(`Generated final QR code for ${qslId}, data URL length: ${finalQrDataUrl.length}`);
    } catch (qrError) {
      console.error('Final QR code generation error:', qrError);
      // 生成备用QR码
      finalQrDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(`
        <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="300" fill="black"/>
          <text x="150" y="150" text-anchor="middle" fill="white" font-size="18">${qslId}</text>
        </svg>
      `).toString('base64');
    }

    pagesHTML += `
      <div class="qsl-page qr-page" style="page-break-before: always;">
        ${generateFinalQRPageHTML(qslId, finalQrDataUrl)}
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>QSL Label Layout 1 - ${qslId}</title>
        <style>
          ${getLayout1CSS()}
        </style>
      </head>
      <body>
        ${pagesHTML}
      </body>
      </html>
    `;
  } catch (error) {
    console.error('Error in generateLayout1HTML:', error);
    throw error;
  }
}

/**
 * 生成QSO数据页面HTML - 按照Python 6x6网格布局精确实现
 */
function generateQSODataPageHTML(toRadio, logs, qslId, qrDataUrl) {
  return `
    <div class="qso-grid">
      <!-- Row 0: Header -->
      <div class="header-row">
        <div class="to-radio-section">
          <span class="to-radio-label">To Radio:</span>
          <span class="callsign">${toRadio}</span>
        </div>
        <div class="pse-qsl">PSE QSL TNX</div>
      </div>
      
      <!-- Row 1: Column Headers -->
      <div class="column-headers">
        <div class="header-cell">Date</div>
        <div class="header-cell">UTC</div>
        <div class="header-cell">RST</div>
        <div class="header-cell">MHz</div>
        <div class="header-cell">Mode</div>
        <div class="qr-area-header"></div>
      </div>
      
      <!-- Rows 2-5: QSO Data -->
      <div class="qso-data-rows">
        ${generateQSORowsHTML(logs)}
        
        <!-- QR Code Area (Col 5, Rows 1-5) -->
        <div class="qr-code-area">
          <img src="${qrDataUrl}" alt="QR Code" class="qr-image" />
        </div>
      </div>
    </div>
  `;
}

/**
 * 生成QSO行HTML - 按照Python分割行逻辑实现
 */
function generateQSORowsHTML(logs) {
  let rowsHTML = '';
  
  for (let i = 0; i < 4; i++) { // 最多4行 (Rows 2-5)
    const log = logs[i];
    const rowIndex = i + 2; // Grid rows 2-5
    
    if (!log) {
      // 空行
      rowsHTML += `<div class="qso-row empty-row" data-row="${rowIndex}"></div>`;
      continue;
    }

    // 格式化日期 - 按照Python逻辑
    let formattedDate = '';
    if (log.qso_date) {
      try {
        const dateStr = log.qso_date.toString();
        if (dateStr.length === 8) {
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          formattedDate = `${day}.${month}.${year}`;
        } else {
          formattedDate = dateStr;
        }
      } catch (e) {
        formattedDate = log.qso_date;
      }
    }

    // 频率判定逻辑 - 完全按照Python实现
    let freqDisplay = '';
    if (log.sat_name) {
      try {
        const freqRx = parseFloat(log.freq_rx || 0);
        const freqTx = parseFloat(log.freq || 0);
        
        if (400 < freqRx && freqRx < 500 && 140 < freqTx && freqTx < 150) {
          freqDisplay = '145/435';
        } else if (140 < freqRx && freqRx < 150 && 400 < freqTx && freqTx < 500) {
          freqDisplay = '435/145';
        } else if (400 < freqRx && freqRx < 500 && 400 < freqTx && freqTx < 500) {
          freqDisplay = '435/435';
        } else if (140 < freqRx && freqRx < 150 && 140 < freqTx && freqTx < 150) {
          freqDisplay = '145/145';
        } else {
          freqDisplay = `${log.freq || ''}/${log.freq_rx || ''}`;
        }
      } catch (e) {
        freqDisplay = `${log.freq || ''}/${log.freq_rx || ''}`;
      }
    } else if (log.mode === 'EYEBALL') {
      freqDisplay = 'N/A';
    } else {
      freqDisplay = (log.freq || '').toString().substring(0, 7);
    }

    // 基础数据
    const timeOn = (log.time_on || '').toString().substring(0, 4);
    const rstRcvd = log.rst_rcvd || '';
    const mode = (log.mode || '').toString().substring(0, 7);

    // 备注和卫星信息 - 按照Python下半部分逻辑
    let commentText = '';
    let infoText = '';
    
    if (log.comment) {
      commentText = `备注: ${log.comment.toString().substring(0, 25)}`;
    }
    
    if (log.sat_name) {
      infoText = `Satellite: via ${log.sat_name}`;
    } else if (log.mode === 'EYEBALL') {
      infoText = `Type: ${log.submode || ''}`;
    }

    // 检测长文本并应用样式
    const getTextClass = (text) => {
      return text && text.length > 7 ? 'qso-cell long-text' : 'qso-cell';
    };

    rowsHTML += `
      <div class="qso-row" data-row="${rowIndex}">
        <!-- 上半部分: 原始QSO信息 -->
        <div class="qso-upper">
          <div class="${getTextClass(formattedDate)} date">${formattedDate}</div>
          <div class="${getTextClass(timeOn)} utc">${timeOn}</div>
          <div class="${getTextClass(rstRcvd)} rst">${rstRcvd}</div>
          <div class="qso-cell freq">${freqDisplay}</div>
          <div class="${getTextClass(mode)} mode">${mode}</div>
        </div>
        
        <!-- 下半部分: 备注及卫星信息 - 在对应QSO下方 -->
        <div class="qso-lower">
          <div class="comment-info">
            ${commentText ? `<span class="comment">${commentText}</span>` : ''}
            ${infoText ? `<span class="info">${infoText}</span>` : ''}
          </div>
        </div>
        
        ${i < 3 ? '<div class="row-separator"></div>' : ''}
      </div>
    `;
  }
  
  return rowsHTML;
}

/**
 * 生成最终QR码页面HTML - 按照Python第二部分实现
 */
function generateFinalQRPageHTML(qslId, qrDataUrl) {
  return `
    <div class="final-qr-container">
      <img src="${qrDataUrl}" alt="QSL QR Code" class="final-qr-image" />
      <div class="qsl-id-text">${qslId}</div>
    </div>
  `;
}

/**
 * Layout 1 CSS - 完全按照Python布局规格实现，使用指定字体
 */
function getLayout1CSS() {
  return `
    @page {
      size: 70mm 50mm;
      margin: 0;
    }
    
    @font-face {
      font-family: 'MapleMono';
      src: url('/MapleMonoNL-Regular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    
    @font-face {
      font-family: 'ChineseFont';
      src: url('/Cinese.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'MapleMono', 'ChineseFont', 'SimSun', 'Microsoft YaHei', monospace;
      background: white;
      color: black;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .qsl-page {
      width: 70mm;
      height: 50mm;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    
    /* 6x6 网格布局 - 按照Python精确实现 */
    .qso-grid {
      width: 70mm;
      height: 50mm;
      position: relative;
    }
    
    /* Row 0: Header - 按照Python坐标系统 */
    .header-row {
      position: absolute;
      top: 0;
      left: 0;
      width: 70mm;
      height: 8.33mm; /* 50mm/6 = 8.33mm per row */
      display: flex;
      align-items: flex-end;
      padding-bottom: 1mm;
    }
    
    .to-radio-section {
      position: absolute;
      left: 2mm; /* Python start_x */
      bottom: 2.5mm; /* Python start_y offset */
      display: flex;
      align-items: baseline;
    }
    
    .to-radio-label {
      font-family: 'MapleMono', monospace;
      font-size: 10pt; /* 减小字体大小 */
      font-weight: normal;
    }
    
    .callsign {
      font-family: 'MapleMono', monospace;
      font-size: 8pt; /* 减小字体大小 */
      margin-left: 0;
      max-width: 25mm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .pse-qsl {
      position: absolute;
      left: 46.67mm; /* Col 4.5 center: 70mm * 4.5/6 */
      bottom: 4.17mm; /* Row center */
      font-family: 'MapleMono', monospace;
      font-size: 7pt;
      text-align: center;
      white-space: nowrap;
    }
    
    /* Row 1: Column Headers */
    .column-headers {
      position: absolute;
      top: 8.33mm;
      left: 0;
      width: 58.33mm; /* 前5列: 70mm * 5/6 */
      height: 8.33mm;
      display: flex;
      border-bottom: 0.5pt solid black;
    }
    
    .header-cell {
      flex: 1;
      font-family: 'MapleMono', monospace;
      font-size: 7pt;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: normal;
    }
    
    /* Rows 2-5: QSO Data Area */
    .qso-data-rows {
      position: absolute;
      top: 16.67mm; /* Row 2 start */
      left: 0;
      width: 58.33mm; /* 前5列 */
      height: 33.33mm; /* 4行 */
    }
    
    /* QSO行样式 - 绝对定位确保精确位置 */
    .qso-row {
      position: absolute;
      width: 58.33mm;
      height: 8.33mm;
      left: 0;
    }
    
    .qso-row[data-row="2"] { top: 0; }
    .qso-row[data-row="3"] { top: 8.33mm; }
    .qso-row[data-row="4"] { top: 16.67mm; }
    .qso-row[data-row="5"] { top: 25mm; }
    
    /* 上半部分: QSO基础数据 */
    .qso-upper {
      position: absolute;
      top: 0;
      left: 0;
      width: 58.33mm;
      height: 4.17mm; /* 行高的一半 */
      display: flex;
    }
    
    .qso-cell {
      flex: 1;
      font-family: 'MapleMono', monospace;
      text-align: center;
      font-size: 6pt;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      white-space: nowrap;
      padding: 0 0.5mm;
      max-width: none; /* 移除宽度限制 */
    }
    
    .qso-cell.freq {
      font-size: 7pt;
    }
    
    .qso-cell.long-text {
      font-size: 5pt;
    }
    
    /* 下半部分: 备注和卫星信息 */
    .qso-lower {
      position: absolute;
      top: 4.17mm; /* 下半部分 */
      left: 5.83mm; /* Col 0中心: 70mm/6/2 */
      width: 52.5mm;
      height: 4.17mm;
      display: flex;
      align-items: center;
    }
    
    .comment-info {
      font-family: 'MapleMono', 'ChineseFont', monospace;
      font-size: 6pt;
      display: flex;
      gap: 3mm;
      width: 100%;
      overflow: visible;
      white-space: nowrap;
    }
    
    .comment {
      color: #333;
      flex-shrink: 0;
    }
    
    .info {
      color: #666;
      flex-shrink: 1;
    }
    
    /* 行分隔线 - 精确位置 */
    .row-separator {
      position: absolute;
      bottom: 0;
      left: 1mm;
      width: 56.33mm; /* 调整宽度，不延伸到QR码区域 */
      height: 0.2pt;
      background: black;
    }
    
    /* QR码区域 - 按照Python精确定位 */
    .qr-code-area {
      position: absolute;
      top: 8.33mm; /* Row 1 start */
      left: 58.33mm; /* Col 6 start */
      width: 11.67mm; /* Col 6 width */
      height: 33.33mm; /* Rows 1-5 */
      display: flex;
      align-items: center;
      justify-content: center;
      /* Python QR_Y_OFFSET_MM向上偏移 */
      transform: translateY(-1.7mm);
    }
    
    .qr-image {
      width: 8mm; /* 减小QR码尺寸 */
      height: 8mm;
      object-fit: contain;
    }
    
    /* 最终QR码页面样式 */
    .qr-page .final-qr-container {
      width: 70mm;
      height: 50mm;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      /* Python QR_PAGE_Y_OFFSET向上偏移 */
      transform: translateY(5mm);
    }
    
    .final-qr-image {
      width: 20mm; /* 减小QR码尺寸 */
      height: 20mm;
      object-fit: contain;
    }
    
    .qsl-id-text {
      font-family: 'MapleMono', monospace;
      font-size: 10pt; /* 减小字体 */
      font-weight: bold;
      text-align: center;
      margin-top: 3mm;
    }
    
    /* 打印优化 */
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .qsl-page {
        page-break-inside: avoid;
      }
    }
  `;
}

/**
 * 生成Layout 2 HTML - 按照Python generate_layout_2实现
 * 仅生成QSL ID二维码页
 */
async function generateLayout2HTML(qslId) {
  try {
    // 生成二维码 - 按照Python规格，但使用较小尺寸
    let qrDataUrl;
    try {
      qrDataUrl = await QRCode.toDataURL(qslId, {
        errorCorrectionLevel: 'H',
        width: 300, // 缩小尺寸对应25mm QR码
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      console.log(`Generated Layout 2 QR code for ${qslId}, data URL length: ${qrDataUrl.length}`);
    } catch (qrError) {
      console.error('Layout 2 QR code generation error:', qrError);
      // 生成备用QR码
      qrDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(`
        <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="300" fill="black"/>
          <text x="150" y="150" text-anchor="middle" fill="white" font-size="18">${qslId}</text>
        </svg>
      `).toString('base64');
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>QSL Label Layout 2 - ${qslId}</title>
        <style>
          ${getLayout2CSS()}
        </style>
      </head>
      <body>
        <div class="qsl-page qr-page">
          ${generateFinalQRPageHTML(qslId, qrDataUrl)}
        </div>
      </body>
      </html>
    `;
  } catch (error) {
    console.error('Error in generateLayout2HTML:', error);
    throw error;
  }
}

/**
 * Layout 2 CSS - 使用指定字体，QR码尺寸调整
 */
function getLayout2CSS() {
  return `
    @page {
      size: 70mm 50mm;
      margin: 0;
    }
    
    @font-face {
      font-family: 'MapleMono';
      src: url('/MapleMonoNL-Regular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    
    @font-face {
      font-family: 'ChineseFont';
      src: url('/Cinese.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'MapleMono', 'ChineseFont', 'SimSun', 'Microsoft YaHei', monospace;
      background: white;
      color: black;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .qsl-page {
      width: 70mm;
      height: 50mm;
      position: relative;
      page-break-after: always;
    }
    
    .qr-page .final-qr-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3mm;
    }
    
    .final-qr-image {
      width: 25mm;
      height: 25mm;
      object-fit: contain;
    }
    
    .qsl-id-text {
      font-family: 'MapleMono', monospace;
      font-size: 12pt;
      font-weight: bold;
      text-align: center;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;
}