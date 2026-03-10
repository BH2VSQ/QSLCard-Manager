import { FREQ_BAND_MAP } from './constants.js';

/**
 * 根据频率（MHz）自动判断波段
 * @param {number|string} freq - 频率（支持 "14.2" 或 "14.2G" 格式）
 * @returns {string|null} - 波段名称，如 "20m"，未匹配返回 null
 */
export const freqToBand = (freq) => {
  if (!freq) return null;

  let freqMhz = 0;
  const freqStr = String(freq).toLowerCase().trim();

  // 处理 GHz 格式（如 "1.2G"）
  if (freqStr.includes('g')) {
    freqMhz = parseFloat(freqStr.replace('g', '')) * 1000;
  } else {
    freqMhz = parseFloat(freqStr);
  }

  if (isNaN(freqMhz)) return null;

  // 查找匹配的波段
  for (const [band, [lower, upper]] of Object.entries(FREQ_BAND_MAP)) {
    if (freqMhz >= lower && freqMhz <= upper) {
      return band;
    }
  }

  return null;
};

/**
 * 判断卫星通联的频率组合
 * @param {number} freqRx - 接收频率（MHz）
 * @param {number} freqTx - 发射频率（MHz）
 * @returns {string} - 频率组合字符串，如 "145/435"
 */
export const getSatelliteFreqCombo = (freqRx, freqTx) => {
  const rx = parseFloat(freqRx);
  const tx = parseFloat(freqTx);

  if (isNaN(rx) || isNaN(tx)) {
    return `${freqTx || 'N/A'}/${freqRx || 'N/A'}`;
  }

  // 判断频率范围
  const is145Rx = rx >= 140 && rx <= 150;
  const is435Rx = rx >= 400 && rx <= 500;
  const is145Tx = tx >= 140 && tx <= 150;
  const is435Tx = tx >= 400 && tx <= 500;

  if (is435Rx && is145Tx) return '145/435';
  if (is145Rx && is435Tx) return '435/145';
  if (is435Rx && is435Tx) return '435/435';
  if (is145Rx && is145Tx) return '145/145';

  // 默认返回原始值
  return `${tx}/${rx}`;
};

/**
 * 验证频率是否在有效范围内
 * @param {number} freq - 频率（MHz）
 * @returns {boolean}
 */
export const isValidFreq = (freq) => {
  const freqNum = parseFloat(freq);
  if (isNaN(freqNum)) return false;
  
  // 业余无线电频率范围：1.8 MHz - 250 GHz
  return freqNum >= 1.8 && freqNum <= 250000;
};
