# ADIF导入功能增强

## 概述

QSL Manager的ADIF导入功能已经得到显著增强，现在支持完整的ADIF数据导入和智能合并功能。

## 新增功能

### 1. 完整的ADIF字段支持

现在支持导入以下完整的ADIF字段：

#### 基本通联信息
- `CALL` - 对方呼号
- `QSO_DATE` - 通联日期
- `TIME_ON` - 开始时间
- `TIME_OFF` - 结束时间
- `FREQ` - 频率
- `FREQ_RX` - 接收频率
- `BAND` - 波段
- `BAND_RX` - 接收波段
- `MODE` - 通信模式
- `SUBMODE` - 子模式

#### 信号报告
- `RST_SENT` - 发送信号报告
- `RST_RCVD` - 接收信号报告
- `TX_PWR` - 发射功率

#### 备注信息
- `COMMENT` - 备注
- `NOTES` - 笔记

#### 位置信息
- `GRIDSQUARE` - 对方网格坐标
- `MY_GRIDSQUARE` - 我方网格坐标

#### 卫星通信
- `SAT_NAME` - 卫星名称
- `SAT_MODE` - 卫星模式
- `PROP_MODE` - 传播模式

#### 中继台信息
- `REPEATER_CALLSIGN` - 中继台呼号
- `REPEATER_LOCATION` - 中继台位置
- `UPLINK_FREQ` - 上行频率
- `DOWNLINK_FREQ` - 下行频率

#### QSL状态
- `QSL_SENT` - QSL发送状态
- `QSL_RCVD` - QSL接收状态
- `QSLSDATE` / `QSL_SENT_DATE` - QSL发送日期
- `QSLRDATE` / `QSL_RCVD_DATE` - QSL接收日期

### 2. 智能合并功能

当导入的ADIF文件包含与现有日志相同的通联记录时，系统会自动检测并智能合并信息：

#### 重复检测规则
- 相同呼号 (`station_callsign`)
- 相同日期 (`qso_date`)
- 时间差在5分钟内 (`time_on`)

#### 合并策略

**字段优先级合并**：
- 如果现有记录某字段为空，而新记录有值，则使用新记录的值
- 适用字段：`rst_sent`, `rst_rcvd`, `tx_pwr`, `time_off`, `freq_rx`, `band_rx`, `submode`, `sat_name`, `sat_mode`, `prop_mode`, `gridsquare`, `my_gridsquare`, `repeater_callsign`, `repeater_location`, `uplink_freq`, `downlink_freq`

**备注信息合并**：
- `comment` 和 `notes` 字段采用追加模式
- 如果现有记录为空，直接使用新记录的值
- 如果现有记录有值且新记录的内容不重复，则用 " | " 分隔符追加

**QSL状态合并**：
- 如果现有记录QSL状态为'N'或空，而新记录有更新的状态，则使用新记录的状态
- QSL日期只在现有记录为空时才更新

#### 合并示例

**现有记录**：
```
呼号: BH1ABC
日期: 20240315
时间: 1230
频率: 14.205
模式: SSB
信号报告: (空)
备注: (空)
```

**新导入记录**：
```
呼号: BH1ABC
日期: 20240315
时间: 1232
频率: 14.205
模式: SSB
信号报告: 59/59
备注: Nice contact from Beijing
```

**合并后结果**：
```
呼号: BH1ABC
日期: 20240315
时间: 1230
频率: 14.205
模式: SSB
信号报告: 59/59  ← 从新记录合并
备注: Nice contact from Beijing  ← 从新记录合并
```

### 3. 导入结果统计

导入完成后，系统会提供详细的统计信息：

- **新导入记录数** (`imported_count`): 全新的日志记录数量
- **合并记录数** (`merged_count`): 与现有记录合并的数量
- **重复记录数** (`duplicate_count`): 完全重复跳过的记录数量
- **错误记录数** (`error_count`): 处理失败的记录数量

### 4. 导出功能增强

ADIF导出功能也得到了增强，现在支持导出所有新增的字段，确保数据的完整性。

## 使用方法

1. 在日志管理页面点击"导入ADIF"按钮
2. 选择ADIF文件进行上传
3. 系统自动解析并处理数据
4. 查看导入结果统计信息

## 技术实现

### 文件修改

1. **server/utils/adifParser.js**
   - 增强ADIF字段解析支持
   - 修复字段映射问题
   - 增加导出字段支持

2. **server/routes/logs.js**
   - 实现智能合并逻辑
   - 添加合并辅助函数
   - 更新导入统计信息

3. **src/pages/LogManagement.jsx**
   - 更新导入成功消息显示
   - 显示详细的导入统计

### 核心函数

- `shouldMergeLog(existingLog, newRecord)`: 判断是否需要合并
- `mergeLogData(existingLog, newRecord)`: 执行数据合并
- `parseADIF(content)`: 解析ADIF文件内容
- `generateADIF(logs, options)`: 生成ADIF导出内容

## 注意事项

1. **备份数据**：在大量导入前建议备份现有数据库
2. **文件格式**：确保ADIF文件格式正确，遵循ADIF 3.1.0标准
3. **字符编码**：建议使用UTF-8编码的ADIF文件
4. **合并逻辑**：系统会自动合并信息，但不会覆盖现有的有效数据

## 兼容性

- 支持ADIF 3.1.0标准
- 向后兼容现有的ADIF文件
- 支持各种业余无线电软件导出的ADIF格式

这次增强使QSL Manager的ADIF导入功能更加完善和智能，能够更好地处理复杂的日志数据导入场景。