import React, { useState, useRef } from 'react';
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
  Modal,
} from 'antd';
import {
  ScanOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { Html5Qrcode } from 'html5-qrcode';
import { qslApi } from '../api';
import { STATUS_TEXT, DIRECTION_TEXT } from '../utils/constants';
import { formatQslId } from '../utils/formatters';

const { Title, Text } = Typography;

const Inventory = () => {
  const [qslId, setQslId] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [continuousMode, setContinuousMode] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const html5QrCodeRef = useRef(null);

  const performScan = async (inputId) => {
    const id = (inputId !== undefined ? inputId : qslId).trim();
    if (!id) {
      message.warning('请输入 QSL ID');
      return;
    }

    try {
      setLoading(true);
      const response = await qslApi.scan(id);

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

  const handleScan = () => performScan();

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      performScan();
    }
  };

  const startCamera = async () => {
    setCameraOpen(true);
    setCameraError('');

    // 摄像头需要安全上下文（HTTPS 或 localhost），HTTP 访问会被浏览器拦截
    if (!window.isSecureContext) {
      setCameraError('摄像头调用需要 HTTPS 环境。当前为 HTTP 访问，请改用 HTTPS 访问，或在 localhost 下调试。');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('当前浏览器不支持摄像头调用（getUserMedia 不可用），请使用最新版 Chrome / Safari / Edge。');
      return;
    }

    // 等待 Modal 内的容器渲染完成后再初始化摄像头
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const reader = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = reader;
      await reader.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const id = (decodedText || '').trim();
          if (id) {
            stopCamera();
            performScan(id);
          }
        },
        () => {
          // 逐帧解码失败，忽略
        }
      );
    } catch (err) {
      setCameraError('无法访问摄像头：' + (err && err.message ? err.message : err));
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        // 忽略停止时的错误
      }
      html5QrCodeRef.current = null;
    }
    setCameraOpen(false);
  };

  return (
    <div>
      <Card title={<Title level={3} style={{ margin: 0 }}>出入库管理</Title>}>
        {/* 扫码输入 */}
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>QSL ID:</Text>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Input
                size="large"
                placeholder="扫描或输入 QSL ID"
                value={qslId}
                onChange={(e) => setQslId(e.target.value)}
                onKeyPress={handleKeyPress}
                style={{ flex: 1, minWidth: 220 }}
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
              <Button size="large" icon={<CameraOutlined />} onClick={startCamera}>
                摄像头扫码
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
            </div>
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

      {/* 摄像头扫码弹窗 */}
      <Modal
        title="摄像头扫码"
        open={cameraOpen}
        onCancel={stopCamera}
        footer={null}
        destroyOnClose
      >
        <div id="qr-reader" style={{ width: '100%' }} />
        {cameraError && (
          <Alert type="error" message={cameraError} style={{ marginTop: 12 }} />
        )}
      </Modal>
    </div>
  );
};

export default Inventory;
