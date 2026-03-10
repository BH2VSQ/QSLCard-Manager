/**
 * ADIF 解析器
 * 支持基本的 ADIF 格式解析和生成
 */

/**
 * 解析 ADIF 文件
 * @param {string} content - ADIF 文件内容
 * @returns {Array} - 解析后的记录数组
 */
export const parseADIF = (content) => {
  const records = [];
  
  // 移除头部（<EOH> 之前的内容）
  const eohIndex = content.toUpperCase().indexOf('<EOH>');
  const dataContent = eohIndex >= 0 ? content.substring(eohIndex + 5) : content;
  
  // 分割记录（以 <EOR> 为分隔符）
  const recordStrings = dataContent.split(/<EOR>/i);
  
  for (const recordStr of recordStrings) {
    if (!recordStr.trim()) continue;
    
    const record = parseRecord(recordStr);
    if (record && record.call) {
      records.push(record);
    }
  }
  
  return records;
};

/**
 * 解析单条记录
 * @param {string} recordStr - 记录字符串
 * @returns {Object} - 解析后的记录对象
 */
function parseRecord(recordStr) {
  const record = {};
  
  // 匹配 ADIF 字段格式: <FIELD:LENGTH>VALUE
  const fieldRegex = /<([^:>]+):(\d+)(?::([^>]+))?>([^<]*)/gi;
  let match;
  
  while ((match = fieldRegex.exec(recordStr)) !== null) {
    const fieldName = match[1].toLowerCase();
    const fieldLength = parseInt(match[2]);
    const fieldValue = match[4].substring(0, fieldLength);
    
    // 映射 ADIF 字段到数据库字段
    switch (fieldName) {
      case 'call':
        record.call = fieldValue.toUpperCase();
        break;
      case 'qso_date':
        record.qso_date = fieldValue;
        break;
      case 'time_on':
        record.time_on = fieldValue;
        break;
      case 'freq':
        record.freq = parseFloat(fieldValue);
        break;
      case 'band':
        record.band = fieldValue;
        break;
      case 'mode':
        record.mode = fieldValue.toUpperCase();
        break;
      case 'rst_sent':
        record.rst_sent = fieldValue;
        break;
      case 'rst_rcvd':
        record.rst_rcvd = fieldValue;
        break;
      case 'station_callsign':
      case 'operator':
        record.station_callsign = fieldValue.toUpperCase();
        break;
      case 'comment':
      case 'notes':
        record.comment = fieldValue;
        break;
      case 'tx_pwr':
        record.tx_pwr = parseFloat(fieldValue);
        break;
      case 'sat_name':
        record.sat_name = fieldValue;
        break;
      case 'sat_mode':
        record.sat_mode = fieldValue;
        break;
      case 'my_gridsquare':
      case 'gridsquare':
        record.my_gridsquare = fieldValue;
        break;
      // 可以添加更多字段映射
    }
  }
  
  return record;
}

/**
 * 生成 ADIF 文件内容
 * @param {Array} logs - 日志数组
 * @param {Object} options - 选项
 * @returns {string} - ADIF 文件内容
 */
export const generateADIF = (logs, options = {}) => {
  const {
    programId = 'QSL Manager',
    programVersion = '2.0.0',
    adifVersion = '3.1.0'
  } = options;
  
  let content = '';
  
  // 头部
  content += `ADIF Export from ${programId}\n`;
  content += `<ADIF_VER:${adifVersion.length}>${adifVersion}\n`;
  content += `<PROGRAMID:${programId.length}>${programId}\n`;
  content += `<PROGRAMVERSION:${programVersion.length}>${programVersion}\n`;
  content += `<EOH>\n\n`;
  
  // 记录
  for (const log of logs) {
    content += generateRecord(log);
    content += '\n';
  }
  
  return content;
};

/**
 * 生成单条记录
 * @param {Object} log - 日志对象
 * @returns {string} - ADIF 记录字符串
 */
function generateRecord(log) {
  let record = '';
  
  // 必需字段
  if (log.station_callsign) {
    record += formatField('CALL', log.station_callsign);
  }
  
  if (log.qso_date) {
    record += formatField('QSO_DATE', log.qso_date.toString());
  }
  
  if (log.time_on) {
    const timeStr = log.time_on.toString().padStart(4, '0');
    record += formatField('TIME_ON', timeStr);
  }
  
  // 可选字段
  if (log.freq) {
    record += formatField('FREQ', log.freq.toString());
  }
  
  if (log.band) {
    record += formatField('BAND', log.band);
  }
  
  if (log.mode) {
    record += formatField('MODE', log.mode);
  }
  
  if (log.rst_sent) {
    record += formatField('RST_SENT', log.rst_sent);
  }
  
  if (log.rst_rcvd) {
    record += formatField('RST_RCVD', log.rst_rcvd);
  }
  
  if (log.my_callsign) {
    record += formatField('STATION_CALLSIGN', log.my_callsign);
  }
  
  if (log.tx_pwr) {
    record += formatField('TX_PWR', log.tx_pwr.toString());
  }
  
  if (log.notes) {
    record += formatField('COMMENT', log.notes);
  }
  
  // 卫星字段
  if (log.sat_name) {
    record += formatField('SAT_NAME', log.sat_name);
  }
  
  if (log.sat_mode) {
    record += formatField('SAT_MODE', log.sat_mode);
  }
  
  if (log.my_gridsquare) {
    record += formatField('MY_GRIDSQUARE', log.my_gridsquare);
  }
  
  // QSL 字段
  if (log.qsl_sent) {
    record += formatField('QSL_SENT', log.qsl_sent);
  }
  
  if (log.qsl_rcvd) {
    record += formatField('QSL_RCVD', log.qsl_rcvd);
  }
  
  if (log.qsl_sent_date) {
    record += formatField('QSLSDATE', log.qsl_sent_date.toString());
  }
  
  if (log.qsl_rcvd_date) {
    record += formatField('QSLRDATE', log.qsl_rcvd_date.toString());
  }
  
  record += '<EOR>\n';
  
  return record;
}

/**
 * 格式化 ADIF 字段
 * @param {string} name - 字段名
 * @param {string} value - 字段值
 * @returns {string} - 格式化后的字段
 */
function formatField(name, value) {
  if (!value) return '';
  const valueStr = value.toString();
  return `<${name}:${valueStr.length}>${valueStr}\n`;
}

export default {
  parseADIF,
  generateADIF
};
