import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  message,
  Typography,
  Descriptions,
  Table,
  Tag,
  Empty,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { qslApi } from '../api';
import { STATUS_TEXT, DIRECTION_TEXT } from '../utils/constants';
import { formatQslId, formatDate, formatTime, formatFreq } from '../utils/formatters';

const { Title, Text } = Typography;

const Scanner = () => {
  const [qslId, setQslId] = useState('');
  const [loading, setLoading] = useState(false);
  const [cardInfo, setCardInfo] = useState(null);
  const [logs, setLogs] = useState([]);

  const handleSearch = async () => {
    if (!qslId || !qslId.trim()) {
      message.warning('请输入 QSL ID');
      return;
    }

    try {
      setLoading(true);
      
      // 获取卡片信息
      const cardRes = await qslApi.getById(qslId.trim());
      if (cardRes.success) {
        setCardInfo(cardRes.data);
      }

      // 获取关联的日志
      const logsRes = await qslApi.getLogsByQslId(qslId.trim());
      if (logsRes.success) {
        setLogs(logsRes.data);
      }
    } catch (error) {
      message.error('查询失败');
      setCardInfo(null);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleReset = () => {
    setQslId('');
    setCardInfo(null);
    setLogs([]);
  };

  const columns = [
    {
      title: '我方呼号',
      dataIndex: 'my_callsign',
      key: 'my_callsign',
      width: 120,
    },
    {
      title: '对方呼号',
      dataIndex: 'station_callsign',
      key: 'station_callsign',
      width: 120,
    },
    {
      title: '日期',
      dataIndex: 'qso_date',
      key: 'qso_date',
      width: 120,
      render: (text) => formatDate(text),
    },
    {
      title: '时间',
      dataIndex: 'time_on',
      key: 'time_on',
      width: 80,
      render: (text) => formatTime(text),
    },
    {
      title: '频率',
      dataIndex: 'freq',
      key: 'freq',
      width: 120,
      render: (text) => formatFreq(text),
    },
    {
      title: '波段',
      dataIndex: 'band',
      key: 'band',
      width: 80,
    },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 80,
    },
    {
      title: 'RST',
      key: 'rst',
      width: 100,
      render: (_, record) => `${record.rst_sent}/${record.rst_rcvd}`,
    },
  ];

  return (
    <div>
      <Card title={<Title level={3} style={{ margin: 0 }}>手动查询</Title>}>
        {/* 搜索框 */}
        <Space style={{ marginBottom: 24 }}>
          <Text strong>QSL ID:</Text>
          <Input
            size="large"
            placeholder="输入 QSL ID 查询"
            value={qslId}
            onChange={(e) => setQslId(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{ width: 400 }}
            autoFocus
          />
          <Button
            type="primary"
            size="large"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
          >
            查询
          </Button>
          <Button size="large" icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>

        {/* 卡片信息 */}
        {cardInfo && (
          <Card
            title="卡片信息"
            type="inner"
            style={{ marginBottom: 24 }}
          >
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="QSL ID" span={2}>
                <Text code strong>
                  {formatQslId(cardInfo.qsl_id)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="方向">
                <Tag color={cardInfo.direction === 'RC' ? 'blue' : 'green'}>
                  {DIRECTION_TEXT[cardInfo.direction]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={
                    cardInfo.status === 'pending'
                      ? 'orange'
                      : cardInfo.status === 'in_stock'
                      ? 'success'
                      : 'default'
                  }
                >
                  {STATUS_TEXT[cardInfo.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {cardInfo.created_at}
              </Descriptions.Item>
              {cardInfo.updated_at && (
                <Descriptions.Item label="更新时间" span={2}>
                  {cardInfo.updated_at}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {/* 关联日志 */}
        {cardInfo && (
          <Card
            title={`关联日志 (${logs.length} 条)`}
            type="inner"
          >
            {logs.length > 0 ? (
              <Table
                columns={columns}
                dataSource={logs}
                rowKey="id"
                pagination={false}
                scroll={{ x: 800 }}
              />
            ) : (
              <Empty description="暂无关联日志" />
            )}
          </Card>
        )}

        {/* 空状态 */}
        {!cardInfo && !loading && (
          <Empty
            description="请输入 QSL ID 进行查询"
            style={{ marginTop: 48 }}
          />
        )}
      </Card>
    </div>
  );
};

export default Scanner;
