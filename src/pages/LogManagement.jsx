import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Card,
  message,
  Modal,
  Typography,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ImportOutlined,
  ExportOutlined,
  SortAscendingOutlined,
  MergeCellsOutlined,
  PrinterOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logsApi, qslApi, printApi } from '../api';
import { MODES_LIST } from '../utils/constants';

const { Title } = Typography;

const LogManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [filters, setFilters] = useState({
    my_callsign: '',
    callsign: '',
    mode: '',
    qsl_id: '',
  });

  useEffect(() => {
    fetchLogs();
    
    // 检查是否有导入操作
    if (searchParams.get('action') === 'import') {
      handleImportAdif();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        my_callsign: filters.my_callsign,
        station_callsign: filters.callsign,
        mode: filters.mode === '全部模式' ? '' : filters.mode,
        qsl_id: filters.qsl_id,
      };

      const response = await logsApi.getList(params);
      if (response.success) {
        setLogs(response.data.logs);
        setPagination((prev) => ({
          ...prev,
          total: response.data.total,
        }));
      }
    } catch (error) {
      message.error('获取日志列表失败');
      console.error('Fetch logs error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({
      my_callsign: '',
      callsign: '',
      mode: '',
      qsl_id: '',
    });
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleDelete = async (id) => {
    try {
      const response = await logsApi.delete(id);
      if (response.success) {
        message.success('删除成功');
        fetchLogs();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的日志');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条日志吗？`,
      onOk: async () => {
        try {
          const response = await logsApi.batchDelete(selectedRowKeys);
          if (response.success) {
            message.success(`成功删除 ${selectedRowKeys.length} 条日志`);
            setSelectedRowKeys([]);
            fetchLogs();
          }
        } catch (error) {
          message.error('批量删除失败');
        }
      },
    });
  };

  const handleReorder = async () => {
    try {
      const response = await logsApi.reorder();
      if (response.success) {
        message.success('重排序成功');
        fetchLogs();
      }
    } catch (error) {
      message.error('重排序失败');
    }
  };

  const handleDeduplicate = async () => {
    Modal.confirm({
      title: '检查并合并重复项',
      content: '将检查并合并重复的日志记录（5分钟窗口），是否继续？',
      onOk: async () => {
        try {
          const response = await logsApi.deduplicate();
          if (response.success) {
            message.success(`去重完成，合并了 ${response.data.merged_count} 条记录`);
            fetchLogs();
          }
        } catch (error) {
          message.error('去重失败');
        }
      },
    });
  };

  const handleImportAdif = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.adi,.adif';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        setLoading(true);
        const response = await logsApi.importAdif(file);
        if (response.success) {
          const { imported_count, merged_count, duplicate_count, error_count } = response.data;
          let successMsg = `导入成功：${imported_count} 条新记录`;
          
          if (merged_count > 0) {
            successMsg += `，合并 ${merged_count} 条记录`;
          }
          
          if (duplicate_count > 0) {
            successMsg += `，跳过 ${duplicate_count} 条重复记录`;
          }
          
          if (error_count > 0) {
            successMsg += `，${error_count} 条记录处理失败`;
          }
          
          message.success(successMsg);
          fetchLogs();
        }
      } catch (error) {
        message.error('导入失败');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  const handleExportAdif = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的日志');
      return;
    }

    try {
      const response = await logsApi.exportAdif(selectedRowKeys);
      if (response.success) {
        const blob = new Blob([response.data], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qso_export_${Date.now()}.adi`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('导出成功');
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleGenerateQsl = async (direction) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要处理的日志');
      return;
    }

    try {
      setLoading(true);

      // 检查哪些日志需要处理
      const logsToProcess = [];
      let skippedCount = 0;

      for (const logId of selectedRowKeys) {
        const response = await logsApi.getById(logId);
        if (response.success) {
          const log = response.data;
          
          // TC (发卡): 跳过已发卡的
          if (direction === 'TC' && log.qsl_sent === 'Y') {
            skippedCount++;
            continue;
          }
          
          // RC (收卡): 跳过已收卡的
          if (direction === 'RC' && log.qsl_rcvd === 'Y') {
            skippedCount++;
            continue;
          }
          
          logsToProcess.push(logId);
        }
      }

      if (logsToProcess.length === 0) {
        message.info('所有勾选的日志都已经有相应的卡片记录，已全部跳过。');
        setLoading(false);
        return;
      }

      // 确定模式：单卡还是多卡
      let mode = 'multi';
      if (logsToProcess.length > 1) {
        // 显示对话框让用户选择
        const result = await new Promise((resolve) => {
          Modal.confirm({
            title: '选择生成模式',
            content: `共有 ${logsToProcess.length} 条日志需要处理，请选择生成模式：`,
            okText: '每条日志一张卡片',
            cancelText: '所有日志共用一张卡片',
            onOk: () => resolve('multi'),
            onCancel: () => resolve('single'),
          });
        });
        mode = result;
      }

      // 调用生成接口
      const response = await qslApi.generate({
        log_ids: logsToProcess,
        direction,
        mode,
      });

      if (response.success) {
        const count = response.data.length || logsToProcess.length;
        message.success(`成功为 ${count} 条日志生成卡片`);
        setSelectedRowKeys([]);
        fetchLogs();
      }
    } catch (error) {
      message.error('生成卡片失败');
      console.error('Generate QSL error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请勾选一个日志进行标签补打');
      return;
    }
    
    if (selectedRowKeys.length > 1) {
      message.warning('请一次只选择一个日志进行标签补打');
      return;
    }

    const logId = selectedRowKeys[0];

    try {
      const response = await logsApi.getById(logId);
      if (response.success && response.data.qsl_cards && response.data.qsl_cards.length > 0) {
        const cards = response.data.qsl_cards;
        
        // 如果只有一张卡，直接补打
        if (cards.length === 1) {
          const card = cards[0];
          await printApi.addToQueue({
            type: 'qsl_label',
            qsl_id: card.qsl_id,
            layout: card.direction === 'TC' ? 1 : 2,
          });
          message.success('已添加到打印队列');
        } else {
          // 多张卡，让用户选择
          Modal.confirm({
            title: '选择要补打的标签',
            content: (
              <div>
                {cards.map(card => (
                  <div key={card.qsl_id} style={{ marginBottom: 8 }}>
                    <Button
                      block
                      onClick={async () => {
                        await printApi.addToQueue({
                          type: 'qsl_label',
                          qsl_id: card.qsl_id,
                          layout: card.direction === 'TC' ? 1 : 2,
                        });
                        message.success('已添加到打印队列');
                        Modal.destroyAll();
                      }}
                    >
                      {card.direction === 'TC' ? '发卡' : '收卡'}: {card.qsl_id}
                    </Button>
                  </div>
                ))}
              </div>
            ),
            footer: null,
          });
        }
      } else {
        message.info('所选日志没有关联的QSL卡');
      }
    } catch (error) {
      message.error('获取卡片信息失败');
      console.error('Reprint error:', error);
    }
  };

  const handleRecycleCard = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要回收卡号的日志');
      return;
    }

    Modal.confirm({
      title: '回收卡号',
      content: `确定要回收选中的 ${selectedRowKeys.length} 条日志的卡号吗？`,
      onOk: async () => {
        try {
          let successCount = 0;
          for (const logId of selectedRowKeys) {
            const response = await logsApi.getById(logId);
            if (response.success && response.data.qsl_cards) {
              for (const card of response.data.qsl_cards) {
                await qslApi.recycle(card.qsl_id, logId);
                successCount++;
              }
            }
          }
          message.success(`成功回收 ${successCount} 个卡号`);
          setSelectedRowKeys([]);
          fetchLogs();
        } catch (error) {
          message.error('回收卡号失败');
        }
      },
    });
  };

  // 列定义 - 严格按照 Python 原版
  // Python: ["ID", "我方呼号", "对方呼号", "日期", "时间", "TX 波段", "RX 波段", "TX 频率", "RX 频率", "模式", "已发?", "已收?", "备注"]
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      fixed: 'left',
    },
    {
      title: '我方呼号',
      dataIndex: 'my_callsign',
      key: 'my_callsign',
      width: 90,
    },
    {
      title: '对方呼号',
      dataIndex: 'station_callsign',
      key: 'station_callsign',
      width: 90,
    },
    {
      title: '日期',
      dataIndex: 'qso_date',
      key: 'qso_date',
      width: 90,
      render: (text) => {
        if (!text) return '';
        const str = text.toString();
        return `${str.slice(2, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
      },
    },
    {
      title: '时间',
      dataIndex: 'time_on',
      key: 'time_on',
      width: 60,
      render: (text) => {
        if (!text) return '';
        const str = text.toString().padStart(4, '0');
        return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
      },
    },
    {
      title: 'TX频率',
      dataIndex: 'freq',
      key: 'freq',
      width: 80,
      render: (text) => text ? `${text}` : '',
    },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 60,
    },
    {
      title: '已发?',
      dataIndex: 'qsl_sent',
      key: 'qsl_sent',
      width: 50,
      align: 'center',
      render: (text) => (
        <span style={{ color: text === 'Y' ? 'green' : 'red', fontSize: '14px' }}>
          {text === 'Y' ? '✔' : '✖'}
        </span>
      ),
    },
    {
      title: '已收?',
      dataIndex: 'qsl_rcvd',
      key: 'qsl_rcvd',
      width: 50,
      align: 'center',
      render: (text) => (
        <span style={{ color: text === 'Y' ? 'green' : 'red', fontSize: '14px' }}>
          {text === 'Y' ? '✔' : '✖'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/logs/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条日志吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div>
      <Title level={2}>日志管理</Title>

      {/* 过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <Input
              placeholder="实时过滤我方呼号..."
              value={filters.my_callsign}
              onChange={(e) => handleFilterChange('my_callsign', e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Input
              placeholder="实时过滤对方呼号..."
              value={filters.callsign}
              onChange={(e) => handleFilterChange('callsign', e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Input
              placeholder="通过QSL卡号精确查找..."
              value={filters.qsl_id}
              onChange={(e) => handleFilterChange('qsl_id', e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="通联模式"
              value={filters.mode || '全部模式'}
              onChange={(value) => handleFilterChange('mode', value)}
              style={{ width: 150 }}
            >
              <Select.Option value="全部模式">全部模式</Select.Option>
              {MODES_LIST.filter(m => m).map((mode) => (
                <Select.Option key={mode} value={mode}>
                  {mode}
                </Select.Option>
              ))}
            </Select>
          </Space>
          <Space>
            <Button icon={<SortAscendingOutlined />} onClick={handleReorder}>
              按时间重排
            </Button>
            <Button onClick={handleResetFilters}>
              重置所有条件
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 操作按钮 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/logs/new')}
          >
            添加新通联日志
          </Button>
          <Button
            type="primary"
            onClick={() => handleGenerateQsl('RC')}
            disabled={selectedRowKeys.length === 0}
            style={{ backgroundColor: '#1890ff' }}
          >
            确认收卡 (RC)
          </Button>
          <Button
            type="primary"
            onClick={() => handleGenerateQsl('TC')}
            disabled={selectedRowKeys.length === 0}
            style={{ backgroundColor: '#52c41a' }}
          >
            确认发卡 (TC)
          </Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={handleReprint}
            disabled={selectedRowKeys.length === 0}
          >
            补打标签
          </Button>
          <Button
            icon={<DisconnectOutlined />}
            onClick={handleRecycleCard}
            disabled={selectedRowKeys.length === 0}
          >
            回收卡号
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            删除日志 ({selectedRowKeys.length})
          </Button>
          <Button icon={<ImportOutlined />} onClick={handleImportAdif}>
            导入 ADIF
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExportAdif}
            disabled={selectedRowKeys.length === 0}
          >
            导出 ADIF
          </Button>
          <Button icon={<MergeCellsOutlined />} onClick={handleDeduplicate}>
            检查并合并重复项
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchLogs} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* 表格 */}
      <Card>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          onChange={handleTableChange}
          onRow={(record) => ({
            onDoubleClick: () => navigate(`/logs/edit/${record.id}`),
          })}
        />
      </Card>
    </div>
  );
};

export default LogManagement;
