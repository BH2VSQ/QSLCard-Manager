import dayjs from 'dayjs';

/**
 * 格式化日期
 * @param {string} date - YYYYMMDD 格式
 * @returns {string} - YYYY-MM-DD 格式
 */
export const formatDate = (date) => {
  if (!date) return '';
  try {
    return dayjs(date, 'YYYYMMDD').format('YYYY-MM-DD');
  } catch {
    return date;
  }
};

/**
 * 格式化时间
 * @param {string} time - HHMM 或 HHMMSS 格式
 * @returns {string} - HH:MM 格式
 */
export const formatTime = (time) => {
  if (!time) return '';
  const timeStr = time.toString().padStart(4, '0');
  return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
};

/**
 * 格式化日期时间
 * @param {string} datetime - ISO 格式
 * @returns {string}
 */
export const formatDateTime = (datetime) => {
  if (!datetime) return '';
  return dayjs(datetime).format('YYYY-MM-DD HH:mm:ss');
};

/**
 * 获取当前 UTC 时间
 * @returns {object} - { date: 'YYYYMMDD', time: 'HHMM' }
 */
export const getCurrentUTC = () => {
  const now = dayjs().utc();
  return {
    date: now.format('YYYYMMDD'),
    time: now.format('HHmm')
  };
};

/**
 * 格式化频率显示
 * @param {number} freq - 频率（MHz）
 * @returns {string}
 */
export const formatFreq = (freq) => {
  if (!freq) return '';
  const freqNum = parseFloat(freq);
  if (freqNum >= 1000) {
    return `${(freqNum / 1000).toFixed(3)} GHz`;
  }
  return `${freqNum.toFixed(3)} MHz`;
};

/**
 * 格式化 QSL ID 显示（添加分隔符）
 * @param {string} qslId
 * @returns {string}
 */
export const formatQslId = (qslId) => {
  if (!qslId || qslId.length < 10) return qslId;
  // 格式: YY-NNNNNN-RC/TC-HHHH...
  return `${qslId.slice(0, 2)}-${qslId.slice(2, 8)}-${qslId.slice(8, 10)}-${qslId.slice(10)}`;
};
