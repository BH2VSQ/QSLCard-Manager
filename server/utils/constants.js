// 通联模式列表
export const MODES_LIST = [
  '', 'AM', 'ARDOP', 'ATV', 'C4FM', 'CHIP', 'CLO', 'CW', 'DIGITALVOICE',
  'DOMINO', 'DSTAR', 'FAX', 'FM', 'FSK441', 'FT8', 'FT4', 'HELL', 'JT4',
  'JT6M', 'JT9', 'JT44', 'JT65', 'MFSK', 'MSK144', 'MT63', 'OLIVIA',
  'OPERA', 'PACKET', 'PAX', 'PSK', 'PSK2K', 'Q15', 'QRA64', 'ROS',
  'RTTY', 'RTTYM', 'SSB', 'SSTV', 'THOR', 'THRB', 'V4', 'V5', 'VOI',
  'WINMOR', 'WSPR', 'AMSS', 'ASCI', 'PCW', 'EYEBALL'
];

// 频率-波段映射表
export const FREQ_BAND_MAP = {
  '160m': [1.8, 2.0],
  '80m': [3.5, 4.0],
  '60m': [5.0, 5.6],
  '40m': [7.0, 7.3],
  '30m': [10.1, 10.15],
  '20m': [14.0, 14.35],
  '17m': [18.068, 18.168],
  '15m': [21.0, 21.45],
  '12m': [24.89, 24.99],
  '10m': [28.0, 29.7],
  '6m': [50, 54],
  '2m': [144, 148],
  '1.25m': [222, 225],
  '70cm': [420, 450],
  '33cm': [902, 928],
  '23cm': [1240, 1300],
  '13cm': [2300, 2450],
  '9cm': [3400, 3500],
  '5cm': [5650, 5850],
  '3cm': [10000, 10500],
  '1.2cm': [24000, 24250],
  '6mm': [47000, 47200],
  '4mm': [76000, 81000],
  '2.5mm': [122250, 123000],
  '2mm': [134000, 136000],
  '1mm': [241000, 250000]
};

// 波段列表
export const BAND_LIST = [
  '', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m',
  '6m', '2m', '1.25m', '70cm', '33cm', '23cm', '13cm', '9cm', '5cm', '3cm',
  '1.2cm', '6mm', '4mm', '2.5mm', '2mm', '1mm', 'N/A'
];

// QSL 卡片状态
export const QSL_STATUS = {
  PENDING: 'pending',       // 待出/入库
  IN_STOCK: 'in_stock',     // 已入库
  OUT_STOCK: 'out_stock'    // 已出库
};

// QSL 卡片方向
export const QSL_DIRECTION = {
  RC: 'RC',  // 收卡
  TC: 'TC'   // 发卡
};

// 通联类型
export const QSO_TYPES = {
  BASIC: 'Basic (HF/VHF/UHF)',
  SATELLITE: 'Satellite',
  REPEATER: 'Repeater',
  EYEBALL: 'Eyeball'
};

// 卫星频率组合
export const SATELLITE_FREQ_COMBOS = {
  '145/435': { rx: [140, 150], tx: [400, 500] },
  '435/145': { rx: [400, 500], tx: [140, 150] },
  '435/435': { rx: [400, 500], tx: [400, 500] },
  '145/145': { rx: [140, 150], tx: [140, 150] }
};

// 地址智能分行关键词
export const ADDRESS_KEYWORDS = ['省', '市', '州', '县', '区'];

// 标签尺寸（毫米）
export const LABEL_SIZE = {
  WIDTH: 70,
  HEIGHT: 50
};

// 打印队列类型
export const PRINT_TYPES = {
  QSL_LABEL: 'qsl_label',
  ADDRESS_LABEL: 'address_label'
};

// 默认配置
export const DEFAULT_CONFIG = {
  primary_callsign: '',
  theme: 'light',
  continuous_log: false,
  nfc_port: '',
  nfc_baudrate: 9600
};
