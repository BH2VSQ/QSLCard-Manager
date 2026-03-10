import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Tag,
  Popconfirm,
  Input,
  Typography,
  Modal,
  Tabs,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { qslApi, printApi } from '../api';

const { Title, Text } = Typography;

const CardManagement = () => {
  const [loading, setLoading] = useState(false);
  const [allCards, setAllCards] = useState([]); // 存储所有卡片
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    fetchAllCards();
  }, []);

  const fetchAllCards = async () => {
    try {
      setLoading(true);
      
      // 获取所有卡片
      const response = await qslApi.search('', 'pending,in_stock,out_stock');
      if (response.success) {
        const cards = response.data || [];
        setAllCards(cards);
        setPagination(prev => ({
          ...prev,
          current: 1,
          total: getFilteredCards(cards, activeTab).length,
        }));
      }
    } catch (error) {
      message.error('获取卡片列表失败');
      console.error('Fetch cards error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 根据标签页过滤卡片
  const getFilteredCards = (cards, tab) => {
    switch (tab) {
      case 'pending_out':
        return cards.filter(card => card.status === 'pending' && card.direction === 'TC');
      case 'out_stock':
        return cards.filter(card => card.status === 'out_stock');
      case 'in_stock':
        return cards.filter(card => card.status === 'in_stock');
      default:
        return cards;
    }
  };

  // 当标签切换时，更新分页总数
  useEffect(() => {
    const filtered = getFilteredCards(allCards, activeTab);
    setPagination(prev => ({
      ...prev,
      current: 1,
      total: filtered.length,
    }));
  }, [activeTab, allCards]);

  const handleUnbind = async (qslId, logId) => {
    try {
      const response = await qslApi.recycle(qslId, logId);
      if (response.success) {
        message.success('卡片已解绑并回收');
        fetchAllCards(); // 重新获取所有数据
      }
    } catch (error) {
      message.error('解绑失败');
      console.error('Unbind error:', error);
    }
  };

  const handleReprint = async (record) => {
    try {
      // 添加到打印队列
      const response = await printApi.addToQueue({
        type: 'qsl_label',
        qsl_id: record.qsl_id,
        layout: record.direction === 'TC' ? 1 : 2,
        log_ids: record.log_ids,
      });

      if (response.success) {
        message.success('已添加到打印队列');
      }
    } catch (error) {
      message.error('添加到打印队列失败');
      console.error('Reprint error:', error);
    }
  };

  const showCardDetails = (record) => {
    Modal.info({
      title: `卡片详情 - ${record.qsl_id}`,
      width: 600,
      content: (
        <div>
          <p><strong>方向：</strong>{record.direction === 'TC' ? '发出' : '收到'}</p>
          <p><strong>状态：</strong>
            <Tag color={
              record.status === 'pending' ? 'orange' :
              record.status === 'out_stock' ? 'green' : 'blue'
            }>
              {record.status === 'pending' ? '待出库' :
               record.status === 'out_stock' ? '已发出' : '已收到'}
            </Tag>
          </p>
          <p><strong>创建时间：</strong>{record.created_at}</p>
          <p><strong>更新时间：</strong>{record.updated_at || '-'}</p>
          <p><strong>关联日志ID：</strong>{record.log_ids?.join(', ') || '无'}</p>
        </div>
      ),
    });
  };

  const columns = [
    {
      title: 'QSL卡号',
      dataIndex: 'qsl_id',
      key: 'qsl_id',
      width: 150,
      render: (text) => <Text strong code>{text}</Text>,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 100,
      render: (direction) => (
        <Tag color={direction === 'TC' ? 'blue' : 'green'}>
          {direction === 'TC' ? '发出' : '收到'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const statusMap = {
          pending: { text: '待出库', color: 'orange' },
          in_stock: { text: '已收到', color: 'blue' },
          out_stock: { text: '已发出', color: 'green' },
        };
        const config = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '关联日志数',
      dataIndex: 'log_ids',
      key: 'log_count',
      width: 120,
      render: (log_ids) => log_ids?.length || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => showCardDetails(record)}
            >
              详情
            </Button>
          </Tooltip>
          <Tooltip title="补打标签">
            <Button
              type="link"
              size="small"
              icon={<PrinterOutlined />}
              onClick={() => handleReprint(record)}
            >
              补打
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要解绑此卡片吗？"
            description="解绑后卡片将回到未分配状态，关联的日志不会被删除"
            onConfirm={() => handleUnbind(record.qsl_id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DisconnectOutlined />}
            >
              解绑
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  // 获取当前标签页的卡片
  const currentCards = getFilteredCards(allCards, activeTab);
  
  // 应用搜索过滤
  const filteredCards = searchText
    ? currentCards.filter(card =>
        card.qsl_id.toLowerCase().includes(searchText.toLowerCase()) ||
        card.log_ids?.some(id => id.toString().includes(searchText))
      )
    : currentCards;

  // 计算各标签的数量（基于所有卡片）
  const tabItems = [
    {
      key: 'all',
      label: `全部 (${allCards.length})`,
    },
    {
      key: 'pending_out',
      label: `待出库 (${allCards.filter(c => c.status === 'pending' && c.direction === 'TC').length})`,
    },
    {
      key: 'out_stock',
      label: `已发出 (${allCards.filter(c => c.status === 'out_stock').length})`,
    },
    {
      key: 'in_stock',
      label: `已收到 (${allCards.filter(c => c.status === 'in_stock').length})`,
    },
  ];

  return (
    <div>
      <Title level={2}>卡片管理</Title>
      <Text type="secondary">
        查看和管理QSL卡片，支持补打标签和解绑释放卡号
      </Text>

      <Card style={{ marginTop: 24 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索QSL卡号或日志ID"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAllCards}
            loading={loading}
          >
            刷新
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredCards}
          rowKey="qsl_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `当前标签页共 ${currentCards.length} 张卡片，搜索结果 ${total} 张`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default CardManagement;
