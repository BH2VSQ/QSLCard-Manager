import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, List, Typography, Button, Space } from 'antd';
import {
  FileTextOutlined,
  SendOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { statsApi } from '../api';

const { Title } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_logs: 0,
    sent_cards: 0,
    received_cards: 0,
    pending_out: 0,
    pending_in: 0,
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, activitiesRes] = await Promise.all([
        statsApi.getDashboard(),
        statsApi.getRecentActivity(10),
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      }

      if (activitiesRes.success) {
        setActivities(activitiesRes.data);
      }
    } catch (error) {
      console.error('Fetch dashboard data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: '新通联日志',
      icon: <PlusOutlined />,
      onClick: () => navigate('/logs/new'),
      type: 'primary',
    },
    {
      title: '日志管理',
      icon: <FileTextOutlined />,
      onClick: () => navigate('/logs'),
    },
    {
      title: '导入ADIF',
      icon: <ImportOutlined />,
      onClick: () => navigate('/logs?action=import'),
    },
  ];

  return (
    <div>
      <Title level={2}>仪表板</Title>

      {/* 快捷操作 */}
      <Card title="快捷操作" style={{ marginBottom: 24 }}>
        <Space size="middle">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              type={action.type || 'default'}
              icon={action.icon}
              size="large"
              onClick={action.onClick}
            >
              {action.title}
            </Button>
          ))}
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总日志数"
              value={stats.total_logs}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="已发卡片"
              value={stats.sent_cards}
              prefix={<SendOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="已收卡片"
              value={stats.received_cards}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="待处理"
              value={stats.pending_out + stats.pending_in}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 详细统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card title="发卡统计" loading={loading}>
            <Statistic
              title="待出库"
              value={stats.pending_out}
              suffix={`/ ${stats.sent_cards} 总数`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="收卡统计" loading={loading}>
            <Statistic
              title="待入库"
              value={stats.pending_in}
              suffix={`/ ${stats.received_cards} 总数`}
            />
          </Card>
        </Col>
      </Row>

      {/* 近期活动 */}
      <Card title="近期活动" loading={loading}>
        <List
          dataSource={activities}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <span>
                    {item.direction === 'RC' ? '收到' : '寄出'} {item.station_callsign} 的卡片
                  </span>
                }
                description={
                  <span>
                    QSL ID: {item.qsl_id} | 日期: {item.qso_date} | 模式: {item.mode} | 状态: {item.status}
                  </span>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无活动记录' }}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
