# QSL Manager - 完整实现方案

## Python 原版功能完整分析

### 1. QSL 卡片生成逻辑

#### 1.1 确认收卡 (RC) / 确认发卡 (TC)
```python
def process_qsl_cards(self, direction):
    # 1. 检查选中的日志
    # 2. 跳过已处理的日志
    #    - TC: 跳过 qsl_sent = 'Y'
    #    - RC: 跳过 qsl_rcvd = 'Y'
    # 3. 如果有多条日志，询问模式
    #    - single: 所有日志共用一张卡片
    #    - multi: 每条日志一张卡片
    # 4. 根据方向选择布局
    #    - TC: Layout 1 (QSO 数据 + 二维码)
    #    - RC: Layout 2 (纯二维码)
    # 5. 调用 run_print_job
```

#### 1.2 打印任务执行
```python
def run_print_job(self, print_function, log_ids, direction, mode):
    if mode == "single":
        # 生成一个卡号
        qsl_id = QSL_ID_Generator.generate(direction)
        # 关联所有日志
        add_qsl_card(qsl_id, log_ids, direction)
        # 获取所有日志数据
        log_data_list = [get_log_details(log_id) for log_id in log_ids]
        # 打印
        print_function(qsl_id, log_data_list, self)
    else: # multi
        # 为每条日志生成一个卡号
        for log_id in log_ids:
            qsl_id = QSL_ID_Generator.generate(direction)
            add_qsl_card(qsl_id, [log_id], direction)
            log_data_list = [get_log_details(log_id)]
            print_function(qsl_id, log_data_list, self)
```

### 2. 标签布局设计

#### 2.1 Layout 1 (TC - 发卡标签)
**尺寸**: 70mm x 50mm
**结构**: 
- 多页设计（每页最多 4 条 QSO）
- 最后一页：纯二维码页

**每页布局**:
```
Row 0: To Radio: [呼号]                    PSE QSL TNX
Row 1: Date    UTC    RST    MHz    Mode   [QR]
Row 2: [QSO 1 数据]                        [QR]
Row 3: [QSO 2 数据]                        [QR]
Row 4: [QSO 3 数据]                        [QR]
Row 5: [QSO 4 数据]                        [QR]
```

**QSO 数据行（每行分上下两部分）**:
- 上半部分: Date, UTC, RST, MHz, Mode
- 下半部分: 备注 + 卫星信息

**频率显示逻辑**:
- 卫星: 特殊判定（145/435, 435/145, 435/435, 145/145）
- EYEBALL: "N/A"
- 普通: 显示频率值

**最后一页**:
- 35mm x 35mm 居中二维码
- 二维码下方显示 QSL ID

#### 2.2 Layout 2 (RC - 收卡标签)
**尺寸**: 70mm x 50mm
**结构**: 单页
- 35mm x 35mm 居中二维码
- 二维码下方显示 QSL ID

### 3. 补打标签逻辑

```python
def reprint_label(self):
    # 1. 只能选择一条日志
    # 2. 获取该日志的所有卡片
    # 3. 显示对话框让用户选择
    # 4. 根据卡片方向自动选择布局
    #    - RC: Layout 2
    #    - TC: Layout 1
    # 5. 获取该卡片关联的所有日志
    # 6. 打印
```

### 4. 回收卡号逻辑

```python
# 解除日志与卡片的关联
# 卡片状态不变，但不再关联日志
```

### 5. 数据库结构

#### qsl_cards 表
```sql
qsl_id TEXT PRIMARY KEY
direction TEXT  -- 'TC' 或 'RC'
status TEXT     -- 'pending', 'in_stock', 'out_stock'
created_at TEXT
updated_at TEXT
```

#### qsl_log_link 表
```sql
qsl_id TEXT
log_id INTEGER
```

#### logs 表关键字段
```sql
qsl_sent TEXT    -- 'Y' 或 NULL
qsl_rcvd TEXT    -- 'Y' 或 NULL
qsl_sent_date TEXT
qsl_rcvd_date TEXT
```

## 实现清单

### 后端需要实现

1. ✅ QSL 生成接口支持 direction 和 mode
2. ✅ 更新日志状态（qsl_sent/qsl_rcvd）
3. ⚠️ PDF 生成服务需要完整实现 Layout 1 和 Layout 2
4. ✅ 打印队列支持

### 前端需要实现

1. ✅ 确认收卡/确认发卡按钮
2. ✅ 单卡/多卡模式选择对话框
3. ✅ 补打标签功能
4. ✅ 回收卡号功能
5. ⚠️ 需要完善错误处理和用户提示

### PDF 生成服务需要完整重写

当前 `server/services/pdfGenerator.js` 的 `generateQSLLabel` 函数需要：

1. **Layout 1 实现**:
   - 6x6 网格布局
   - 每页最多 4 条 QSO
   - Row 0: 头部（To Radio + 呼号 + PSE QSL TNX）
   - Row 1: 表头（Date, UTC, RST, MHz, Mode）
   - Row 2-5: QSO 数据（上下分割）
   - Col 5: 10mm 二维码
   - 最后一页: 35mm 二维码 + QSL ID

2. **Layout 2 实现**:
   - 单页
   - 35mm 居中二维码
   - QSL ID 文本

3. **频率判定逻辑**:
   - 卫星频率特殊处理
   - EYEBALL 显示 N/A
   - 普通显示频率值

4. **中文字体支持**:
   - 需要加载 MapleMonoNL-Regular.ttf
   - 需要加载 Cinese.ttf
   - jsPDF 需要配置自定义字体

## 关键技术点

1. **jsPDF 中文支持**: 需要使用 jsPDF 的 addFont 方法添加自定义字体
2. **二维码生成**: 使用 qrcode 库，容错率 H
3. **坐标系统**: jsPDF 使用左下角为原点，需要转换
4. **分页逻辑**: 每 4 条 QSO 一页，最后加一页纯二维码
5. **网格布局**: 精确计算每个单元格的位置

## 实施步骤

### 第一步: 完善后端 QSL 生成逻辑 ✅
- 已实现 direction 和 mode 参数
- 已实现状态更新

### 第二步: 重写 PDF 生成服务 ⚠️
- 需要完整实现 Layout 1
- 需要完整实现 Layout 2
- 需要添加中文字体支持

### 第三步: 完善前端交互 ✅
- 已实现确认收卡/确认发卡
- 已实现单卡/多卡选择
- 已实现补打标签
- 已实现回收卡号

### 第四步: 测试验证
- 测试单卡模式
- 测试多卡模式
- 测试补打功能
- 测试回收功能
- 验证 PDF 布局

## 注意事项

1. **纯 JavaScript 要求**: 不能使用需要预编译的库
2. **字体文件**: 需要确保字体文件存在
3. **临时文件**: 使用 temp/ 文件夹
4. **打印队列**: 先添加到队列，用户手动打印
5. **状态管理**: 三阶段状态（未分配 → pending → in_stock/out_stock）

## 当前状态

- ✅ 后端接口完整
- ✅ 前端交互完整
- ⚠️ PDF 生成需要重写（这是最关键的部分）
- ✅ 数据库结构正确
- ✅ 路由配置正确

## 下一步行动

**优先级最高**: 重写 PDF 生成服务，完整实现 Layout 1 和 Layout 2

这需要：
1. 精确的网格计算
2. 中文字体支持
3. 二维码生成和定位
4. 分页逻辑
5. 频率判定逻辑
