import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  message,
  Typography,
  Alert,
  Descriptions,
  Tag,
  Divider,
} from 'antd';
import { ScanOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { qslApi } from '../api';
import { STATUS_TEXT, DIRECTION_TEXT } from '../utils/constants';
import { formatQslId } from '../utils/formatters';

const { Title, Text } = Typography;

const Inventory = () => {
  const [qslId, setQslId] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [continuousMode, setContinuousMode] = useState(true);

  const handleScan = async () => {
    if (!qslId || !qslId.trim()) {
      message.warning('请输入 QSL ID');
      return;
    }

    try {
      setLoading(true);
      const response = await qslApi.scan(qslId.trim());
      
      if (response.success) {
        setScanResult({
          success: true,
          data: response.data,
        });
        message.success(response.message || '操作成功');

        // 连续模式：清空输入框
        if (continuousMode) {
          setQslId('');
        }
      }
    } catch (error) {
      setScanResult({
        success: false,
        error: error.response?.data?.error || '扫码失败',
      });
      message.error(error.response?.data?.error || '扫码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <div>
      <Card title={<Title level={3} style={{ margin: 0 }}>出入库管理</Title>}>
        <Alert
          message="扫码说明"
          description={
            <div>
              <p>• 扫描 QSL ID 进行出入库操作</p>
              <p>• TC（发卡）：pending → out_stock（已出库）</p>
              <p>• RC（收卡）：pending → in_stock（已入库）</p>
              <p>• 连续模式：扫码后自动清空输入框，可连续操作</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* 扫码输入 */}
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>QSL ID:</Text>
            <Space style={{ marginTop: 8, width: '100%' }}>
              <Input
                size="large"
                placeholder="扫描或输入 QSL ID"
                value={qslId}
                onChange={(e) => setQslId(e.target.value)}
                onKeyPress={handleKeyPress}
                style={{ width: 400 }}
                autoFocus
              />
              <Button
                type="primary"
                size="large"
                icon={<ScanOutlined />}
                onClick={handleScan}
                loading={loading}
              >
                扫码
              </Button>
              <Button
                size="large"
                onClick={() => {
                  setQslId('');
                  setScanResult(null);
                }}
              >
                清空
              </Button>
            </Space>
          </div>

          {/* 扫码结果 */}
          {scanResult && (
            <>
              <Divider />
              {scanResult.success ? (
                <Alert
                  message="操作成功"
                  description={
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="QSL ID">
                        <Text code>{formatQslId(scanResult.data.qsl_id)}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="方向">
                        <Tag color={scanResult.data.direction === 'RC' ? 'blue' : 'green'}>
                          {DIRECTION_TEXT[scanResult.data.direction]}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="状态">
                        <Tag color="success">
                          {STATUS_TEXT[scanResult.data.status]}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="呼号信息">
                        <div>
                          <div>对方呼号: <Text code>{scanResult.data.callsign || 'N/A'}</Text></div>
                          <div>我方呼号: <Text code>{scanResult.data.station_callsign || 'N/A'}</Text></div>
                        </div>
                      </Descriptions.Item>
                      <Descriptions.Item label="关联日志">
                        {scanResult.data.log_count || scanResult.data.updated_logs} 条
                      </Descriptions.Item>
                    </Descriptions>
                  }
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                />
              ) : (
                <Alert
                  message="操作失败"
                  description={scanResult.error}
                  type="error"
                  showIcon
                  icon={<CloseCircleOutlined />}
                />
              )}
            </>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default Inventory;
