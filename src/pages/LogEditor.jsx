import { useEffect, useState } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Space,
  message,
  Row,
  Col,
  DatePicker,
  Typography,
  Divider,
} from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { logsApi } from '../api';
import { MODES_LIST, BAND_LIST } from '../utils/constants';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const { Title } = Typography;
const { TextArea } = Input;

const LogEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [qsoType, setQsoType] = useState('Basic (HF/VHF/UHF)');
  const [rcCardId, setRcCardId] = useState('N/A');
  const [tcCardId, setTcCardId] = useState('N/A');

  const isEditMode = !!id;

  useEffect(() => {
    if (isEditMode) {
      fetchLog();
    } else {
      // 新建模式：设置当前 UTC 时间
      const now = dayjs.utc();
      form.setFieldsValue({
        qso_date: now,
        time_on: now.format('HHmm'),
        rst_sent: '59',
        rst_rcvd: '59',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  const fetchLog = async () => {
    try {
      setLoading(true);
      const response = await logsApi.getById(id);
      if (response.success) {
        const log = response.data;
        
        // 确定 QSO 类型
        let type = 'Basic (HF/VHF/UHF)';
        if (log.sat_name) {
          type = 'Satellite';
        } else if (log.mode === 'EYEBALL') {
          type = 'Eyeball';
        } else if (log.freq_rx && log.mode === 'FM') {
          type = 'Repeater';
        }
        setQsoType(type);

        // 设置表单值
        form.setFieldsValue({
          station_callsign: log.station_callsign,
          qso_date: log.qso_date ? dayjs(log.qso_date, 'YYYYMMDD') : null,
          time_on: log.time_on,
          band: log.band,
          band_rx: log.band_rx,
          freq: log.freq,
          freq_rx: log.freq_rx,
          mode: log.mode,
          rst_sent: log.rst_sent,
          rst_rcvd: log.rst_rcvd,
          comment: log.comment,
          sat_name: log.sat_name,
          prop_mode: log.prop_mode,
          submode: log.submode,
          qsl_sent_date: log.qsl_sent_date,
          qsl_rcvd_date: log.qsl_rcvd_date,
        });

        // 获取关联的 QSL 卡片
        if (log.qsl_cards && log.qsl_cards.length > 0) {
          log.qsl_cards.forEach(card => {
            if (card.direction === 'RC') {
              setRcCardId(card.qsl_id);
            } else if (card.direction === 'TC') {
              setTcCardId(card.qsl_id);
            }
          });
        }
      }
    } catch (error) {
      message.error('获取日志失败');
      console.error('Fetch log error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFreqBlur = () => {
    const freqText = form.getFieldValue('freq');
    if (!freqText) return;

    try {
      let freqMhz = 0;
      const lowerText = freqText.toString().toLowerCase();
      
      if (lowerText.includes('g')) {
        freqMhz = parseFloat(lowerText.replace('g', '').trim()) * 1000;
      } else {
        freqMhz = parseFloat(lowerText);
      }

      // 频率到波段的映射
      const freqBandMap = [
        [[1.8, 2.0], '160m'],
        [[3.5, 4.0], '80m'],
        [[5.0, 5.5], '60m'],
        [[7.0, 7.3], '40m'],
        [[10.1, 10.15], '30m'],
        [[14.0, 14.35], '20m'],
        [[18.068, 18.168], '17m'],
        [[21.0, 21.45], '15m'],
        [[24.89, 24.99], '12m'],
        [[28.0, 29.7], '10m'],
        [[50.0, 54.0], '6m'],
        [[144.0, 148.0], '2m'],
        [[222.0, 225.0], '1.25m'],
        [[420.0, 450.0], '70cm'],
        [[902.0, 928.0], '33cm'],
        [[1240.0, 1300.0], '23cm'],
      ];

      for (const [[lower, upper], band] of freqBandMap) {
        if (freqMhz >= lower && freqMhz <= upper) {
          form.setFieldsValue({ band });
          break;
        }
      }
    } catch (error) {
      // 忽略无效输入
    }
  };

  const handleFreqRxBlur = () => {
    const freqRxText = form.getFieldValue('freq_rx');
    if (!freqRxText) return;

    try {
      let freqMhz = 0;
      const lowerText = freqRxText.toString().toLowerCase();
      
      if (lowerText.includes('g')) {
        freqMhz = parseFloat(lowerText.replace('g', '').trim()) * 1000;
      } else {
        freqMhz = parseFloat(lowerText);
      }

      // 频率到波段的映射
      const freqBandMap = [
        [[1.8, 2.0], '160m'],
        [[3.5, 4.0], '80m'],
        [[5.0, 5.5], '60m'],
        [[7.0, 7.3], '40m'],
        [[10.1, 10.15], '30m'],
        [[14.0, 14.35], '20m'],
        [[18.068, 18.168], '17m'],
        [[21.0, 21.45], '15m'],
        [[24.89, 24.99], '12m'],
        [[28.0, 29.7], '10m'],
        [[50.0, 54.0], '6m'],
        [[144.0, 148.0], '2m'],
        [[222.0, 225.0], '1.25m'],
        [[420.0, 450.0], '70cm'],
        [[902.0, 928.0], '33cm'],
        [[1240.0, 1300.0], '23cm'],
      ];

      for (const [[lower, upper], band] of freqBandMap) {
        if (freqMhz >= lower && freqMhz <= upper) {
          form.setFieldsValue({ band_rx: band });
          break;
        }
      }
    } catch (error) {
      // 忽略无效输入
    }
  };

  const handleQsoTypeChange = (value) => {
    setQsoType(value);
    
    if (value === 'Eyeball') {
      form.setFieldsValue({
        mode: 'EYEBALL',
        band: 'N/A',
        band_rx: 'N/A',
        rst_sent: '59+',
        rst_rcvd: '59+',
      });
    } else if (form.getFieldValue('mode') === 'EYEBALL') {
      form.setFieldsValue({ mode: '' });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const data = {
        station_callsign: values.station_callsign.toUpperCase(),
        qso_date: values.qso_date.format('YYYYMMDD'),
        time_on: values.time_on,
        band: values.band,
        band_rx: values.band_rx,
        freq: values.freq,
        freq_rx: values.freq_rx,
        mode: values.mode,
        rst_sent: values.rst_sent,
        rst_rcvd: values.rst_rcvd,
        comment: values.comment,
        sat_name: null,
        prop_mode: null,
        submode: null,
        qsl_sent_date: values.qsl_sent_date || null,
        qsl_rcvd_date: values.qsl_rcvd_date || null,
      };

      // 根据 QSO 类型添加额外字段
      if (qsoType === 'Satellite') {
        data.sat_name = values.sat_name;
        data.prop_mode = values.prop_mode;
      } else if (qsoType === 'Repeater') {
        const repeaterCall = values.repeater_callsign;
        if (repeaterCall) {
          data.comment = `RPT: ${repeaterCall} | ${data.comment || ''}`;
        }
      } else if (qsoType === 'Eyeball') {
        data.submode = values.submode;
      }

      let response;
      if (isEditMode) {
        response = await logsApi.update(id, data);
      } else {
        response = await logsApi.create(data);
      }

      if (response.success) {
        message.success(isEditMode ? '更新成功' : '创建成功');
        navigate('/logs');
      }
    } catch (error) {
      if (error.errorFields) {
        message.error('请填写完整信息');
      } else {
        message.error(isEditMode ? '更新失败' : '创建失败');
        console.error('Save log error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/logs');
  };

  const title = isEditMode ? '编辑通联日志' : `添加新通联日志`;

  return (
    <div>
      <Card
        title={<Title level={3} style={{ margin: 0 }}>{title}</Title>}
        extra={
          <Space>
            <Button icon={<CloseOutlined />} onClick={handleCancel}>
              取消
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            band: '',
            band_rx: '',
            mode: '',
            rst_sent: '59',
            rst_rcvd: '59',
          }}
        >
          {/* QSO 类型选择 */}
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="通联类型:">
                <Select
                  value={qsoType}
                  onChange={handleQsoTypeChange}
                  style={{ width: 300 }}
                  disabled={isEditMode}
                >
                  <Select.Option value="Basic (HF/VHF/UHF)">Basic (HF/VHF/UHF)</Select.Option>
                  <Select.Option value="Satellite">Satellite</Select.Option>
                  <Select.Option value="Repeater">Repeater</Select.Option>
                  <Select.Option value="Eyeball">Eyeball</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 基本信息 */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="对方呼号:"
                name="station_callsign"
                rules={[{ required: true, message: '请输入对方呼号' }]}
              >
                <Input
                  placeholder="对方呼号"
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) => {
                    form.setFieldsValue({ station_callsign: e.target.value.toUpperCase() });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="日期 (UTC):"
                name="qso_date"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="时间 (UTC):"
                name="time_on"
                rules={[{ required: true, message: '请输入时间' }]}
              >
                <Input placeholder="HHMM" maxLength={4} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item 
                label="发射波段:" 
                name="band"
                rules={[{ required: true, message: '请选择发射波段' }]}
              >
                <Select 
                  placeholder="选择波段" 
                  showSearch
                  onChange={() => {
                    // 当波段改变时，重新验证频率字段
                    form.validateFields(['freq']);
                  }}
                >
                  {BAND_LIST.map((band) => (
                    <Select.Option key={band} value={band}>
                      {band}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="接收波段:" name="band_rx">
                <Select placeholder="选择波段" showSearch>
                  {BAND_LIST.map((band) => (
                    <Select.Option key={band} value={band}>
                      {band}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item 
                label="发射频率 (MHz):" 
                name="freq"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const band = getFieldValue('band');
                      if (band === 'N/A') {
                        return Promise.resolve();
                      }
                      if (!value) {
                        return Promise.reject(new Error('请输入发射频率'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.band !== currentValues.band}>
                  {({ getFieldValue }) => {
                    const band = getFieldValue('band');
                    const placeholder = band === 'N/A' ? '波段为N/A时无需填写' : '例如: 14.250';
                    const disabled = band === 'N/A';
                    
                    return (
                      <Input
                        placeholder={placeholder}
                        disabled={disabled}
                        onBlur={handleFreqBlur}
                      />
                    );
                  }}
                </Form.Item>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="接收频率 (MHz):" name="freq_rx">
                <Input 
                  placeholder="例如: 14.250" 
                  onBlur={handleFreqRxBlur}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="模式:"
                name="mode"
                rules={[{ required: true, message: '请选择模式' }]}
              >
                <Select placeholder="选择模式" showSearch>
                  {MODES_LIST.map((mode) => (
                    <Select.Option key={mode} value={mode}>
                      {mode}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                label="发送信号报告:" 
                name="rst_sent"
                rules={[{ required: true, message: '请输入发送信号报告' }]}
              >
                <Input placeholder="例如: 59" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                label="接收信号报告:" 
                name="rst_rcvd"
                rules={[{ required: true, message: '请输入接收信号报告' }]}
              >
                <Input placeholder="例如: 59" />
              </Form.Item>
            </Col>
          </Row>

          {/* 卫星信息 */}
          {qsoType === 'Satellite' && (
            <>
              <Divider>卫星信息</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="卫星名称:"
                    name="sat_name"
                    rules={[{ required: true, message: '请输入卫星名称' }]}
                  >
                    <Input placeholder="例如: SO-50" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="传播模式:" name="prop_mode">
                    <Input placeholder="例如: SAT" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* 中继台信息 */}
          {qsoType === 'Repeater' && (
            <>
              <Divider>中继台信息</Divider>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item label="中继呼号:" name="repeater_callsign">
                    <Input placeholder="中继台呼号" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* Eyeball 信息 */}
          {qsoType === 'Eyeball' && (
            <>
              <Divider>Eyeball 信息</Divider>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item label="Eyeball 类型:" name="submode">
                    <Select placeholder="选择类型">
                      <Select.Option value="EYEBALL">EYEBALL</Select.Option>
                      <Select.Option value="Online EYEBALL">Online EYEBALL</Select.Option>
                      <Select.Option value="Club activity">Club activity</Select.Option>
                      <Select.Option value="Other">Other</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* 备注 */}
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="备注:" name="comment">
                <TextArea rows={4} placeholder="通联备注..." />
              </Form.Item>
            </Col>
          </Row>

          {/* QSL 日期 */}
          <Divider>QSL 信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="发卡时间 (Date):" name="qsl_sent_date">
                <Input placeholder="YYYYMMDD (留空则未发)" maxLength={8} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="收卡时间 (Date):" name="qsl_rcvd_date">
                <Input placeholder="YYYYMMDD (留空则未收)" maxLength={8} />
              </Form.Item>
            </Col>
          </Row>

          {/* 编辑模式：显示关联的 QSL 卡片 */}
          {isEditMode && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="收卡 (RC) 编号:">
                  <Input value={rcCardId} readOnly />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="发卡 (TC) 编号:">
                  <Input value={tcCardId} readOnly />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Card>
    </div>
  );
};

export default LogEditor;
