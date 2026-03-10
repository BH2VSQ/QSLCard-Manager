// 通联模式列表
export const MODES_LIST = [
  '', 'AM', 'ARDOP', 'ATV', 'C4FM', 'CHIP', 'CLO', 'CW', 'DIGITALVOICE',
  'DOMINO', 'DSTAR', 'FAX', 'FM', 'FSK441', 'FT8', 'FT4', 'HELL', 'JT4',
  'JT6M', 'JT9', 'JT44', 'JT65', 'MFSK', 'MSK144', 'MT63', 'OLIVIA',
  'OPERA', 'PACKET', 'PAX', 'PSK', 'PSK2K', 'Q15', 'QRA64', 'ROS',
  'RTTY', 'RTTYM', 'SSB', 'SSTV', 'THOR', 'THRB', 'V4', 'V5', 'VOI',
  'WINMOR', 'WSPR', 'AMSS', 'ASCI', 'PCW', 'EYEBALL'
];

// 波段列表
export const BAND_LIST = [
  '', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m',
  '6m', '2m', '1.25m', '70cm', '33cm', '23cm', '13cm', '9cm', '5cm', '3cm',
  '1.2cm', '6mm', '4mm', '2.5mm', '2mm', '1mm', 'N/A'
];

// 通联类型
export const QSO_TYPES = {
  BASIC: 'Basic (HF/VHF/UHF)',
  SATELLITE: 'Satellite',
  REPEATER: 'Repeater',
  EYEBALL: 'Eyeball'
};

// QSL 状态
export const QSL_STATUS = {
  PENDING: 'pending',
  IN_STOCK: 'in_stock',
  OUT_STOCK: 'out_stock'
};

// QSL 方向
export const QSL_DIRECTION = {
  RC: 'RC',
  TC: 'TC'
};

// 状态文本映射
export const STATUS_TEXT = {
  pending: '待处理',
  in_stock: '已入库',
  out_stock: '已出库'
};

// 方向文本映射
export const DIRECTION_TEXT = {
  RC: '收卡',
  TC: '发卡'
};
