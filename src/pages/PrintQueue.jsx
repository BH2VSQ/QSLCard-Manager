import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  message,
  Tag,
  Popconfirm,
  Typography,
  Modal,
} from 'antd';
import {
  DeleteOutlined,
  PrinterOutlined,
  ClearOutlined,
  ReloadOutlined,
  MergeCellsOutlined,
} from '@ant-design/icons';
import { printApi } from '../api';
import { formatDateTime } from '../utils/formatters';

const { Title, Text } = Typography;

const PrintQueue = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedType, setSelectedType] = useState(null); // 记录当前选中的标签类型

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const response = await printApi.getQueue();
      if (response.success) {
        setQueue(response.data);
      }
    } catch (error) {
      message.error('获取打印队列失败');
      console.error('Fetch queue error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (queueId) => {
    // 数据已经准备好，直接可以打印
    message.info('数据已准备就绪，可以直接打印');
  };

  const handleBatchGenerate = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要生成的项目');
      return;
    }

    Modal.confirm({
      title: '批量准备',
      content: `确定要准备选中的 ${selectedRowKeys.length} 个任务吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await printApi.generateBatch(selectedRowKeys);
          if (response.success) {
            message.success(`成功准备 ${response.data.length} 个打印任务`);
            setSelectedRowKeys([]);
            fetchQueue();
          }
        } catch (error) {
          message.error('批量准备失败');
        }
      },
    });
  };

  const handleMergeAndPrint = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要合并打印的项目');
      return;
    }

    const selectedItems = queue.filter(item => selectedRowKeys.includes(item.id));
    const itemType = selectedItems[0]?.type;
    const typeDisplayName = itemType === 'qsl_label' ? 'QSL标签' : '地址标签';

    Modal.confirm({
      title: `合并打印${typeDisplayName}`,
      content: `确定要将选中的 ${selectedItems.length} 个${typeDisplayName}合并打印吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 使用服务器的批量HTML生成
          const response = await fetch('/api/print/html/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              queue_ids: selectedRowKeys
            })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const htmlContent = await response.text();
          console.log(`Generated batch HTML content length: ${htmlContent.length}`);
          
          // 创建打印窗口
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            throw new Error('无法打开打印窗口，请检查浏览器弹窗设置');
          }
          
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          
          // 等待内容加载完成后打印
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            
            setTimeout(() => {
              printWindow.close();
            }, 1000);
          };
          
          message.success(`已发送${typeDisplayName}合并打印请求`);
        } catch (error) {
          console.error('Merge print error:', error);
          message.error(`合并打印失败: ${error.message}`);
        }
      },
    });
  };

  const generateSimpleHTML = (queueItem) => {
    const { qsl_id, logs, layout } = queueItem;
    const firstLog = logs?.[0] || {};
    const toRadio = firstLog.station_callsign || 'N/A';
    
    // 使用完整的打印服务生成HTML
    if (layout === 1) {
      // Layout 1: 6x6网格 + QR码
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>QSL Label Layout 1 - ${qsl_id}</title>
          <style>
            @page {
              size: 70mm 50mm;
              margin: 0;
            }
            
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              width: 70mm;
              height: 50mm;
              overflow: hidden;
            }

            .grid-container {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              grid-template-rows: repeat(6, 1fr);
              width: 70mm;
              height: 50mm;
              gap: 0;
              position: relative;
            }

            .grid-cell {
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              font-size: 6pt;
              line-height: 1;
              padding: 0.5mm;
              position: relative;
            }

            .header-cell {
              font-size: 10pt;
              font-weight: bold;
              justify-content: flex-start;
              padding-left: 2mm;
              align-items: flex-end;
              padding-bottom: 2.5mm;
            }

            .to-radio-label {
              font-size: 14pt;
              margin-right: 2mm;
            }

            .callsign {
              font-size: 10pt;
            }

            .pse-qsl {
              font-size: 7pt;
              font-weight: bold;
            }

            .column-header {
              font-size: 7pt;
              font-weight: bold;
              border-bottom: 0.5pt solid #000;
            }

            .qso-data {
              font-size: 6pt;
            }

            .qr-area {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 2mm;
            }

            .qr-placeholder {
              width: 10mm;
              height: 10mm;
              background-color: #000;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 4pt;
              text-align: center;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            <!-- Header -->
            <div class="grid-cell header-cell" style="grid-column: 1 / 5; grid-row: 1;">
              <span class="to-radio-label">To Radio:</span>
              <span class="callsign">${toRadio}</span>
            </div>
            <div class="grid-cell pse-qsl" style="grid-column: 5; grid-row: 1;">
              PSE QSL TNX
            </div>

            <!-- Column Headers -->
            <div class="grid-cell column-header" style="grid-column: 1; grid-row: 2;">Date</div>
            <div class="grid-cell column-header" style="grid-column: 2; grid-row: 2;">UTC</div>
            <div class="grid-cell column-header" style="grid-column: 3; grid-row: 2;">RST</div>
            <div class="grid-cell column-header" style="grid-column: 4; grid-row: 2;">MHz</div>
            <div class="grid-cell column-header" style="grid-column: 5; grid-row: 2;">Mode</div>

            <!-- QSO Data (simplified for preview) -->
            ${logs?.slice(0, 4).map((log, i) => {
              const gridRow = i + 3;
              let formattedDate = log.qso_date || '';
              if (formattedDate.length === 8) {
                const day = formattedDate.slice(6, 8);
                const month = formattedDate.slice(4, 6);
                const year = formattedDate.slice(0, 4);
                formattedDate = `${day}.${month}.${year}`;
              }
              
              return `
                <div class="grid-cell qso-data" style="grid-column: 1; grid-row: ${gridRow};">${formattedDate}</div>
                <div class="grid-cell qso-data" style="grid-column: 2; grid-row: ${gridRow};">${(log.time_on || '').toString().slice(0, 4)}</div>
                <div class="grid-cell qso-data" style="grid-column: 3; grid-row: ${gridRow};">${log.rst_rcvd || ''}</div>
                <div class="grid-cell qso-data" style="grid-column: 4; grid-row: ${gridRow};">${log.freq || ''}</div>
                <div class="grid-cell qso-data" style="grid-column: 5; grid-row: ${gridRow};">${log.mode || ''}</div>
              `;
            }).join('')}

            <!-- QR Code Area -->
            <div class="qr-area" style="grid-column: 6; grid-row: 2 / 6;">
              <div class="qr-placeholder">QR<br>${qsl_id}</div>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Layout 2: 单页二维码
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>QSL Label Layout 2 - ${qsl_id}</title>
          <style>
            @page {
              size: 70mm 50mm;
              margin: 0;
            }
            
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              width: 70mm;
              height: 50mm;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }

            .qr-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              transform: translateY(5mm);
            }

            .qr-placeholder {
              width: 35mm;
              height: 35mm;
              background-color: #000;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8pt;
              text-align: center;
              margin-bottom: 5mm;
            }

            .qsl-id {
              font-size: 12pt;
              font-weight: bold;
              color: #000;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="qr-placeholder">QR CODE<br>${qsl_id}</div>
            <div class="qsl-id">${qsl_id}</div>
          </div>
        </body>
        </html>
      `;
    }
  };

  const handlePrint = async (queueId) => {
    try {
      // 从服务器获取完整的HTML内容
      const response = await fetch(`/api/print/html/${queueId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const htmlContent = await response.text();
      console.log(`Generated HTML content length: ${htmlContent.length}`);
      
      // 创建打印窗口
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('无法打开打印窗口，请检查浏览器弹窗设置');
      }
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // 等待内容加载完成后打印
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        
        // 延迟关闭窗口
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      };
      
      message.success('已发送打印请求');
    } catch (error) {
      console.error('Print error:', error);
      message.error(`打印失败: ${error.message}`);
    }
  };

  const handleRemove = async (id) => {
    try {
      const response = await printApi.removeFromQueue(id);
      if (response.success) {
        message.success('已从队列移除');
        fetchQueue();
      }
    } catch (error) {
      message.error('移除失败');
    }
  };

  const handleClearQueue = async () => {
    try {
      const response = await printApi.clearQueue();
      if (response.success) {
        message.success('队列已清空');
        setSelectedRowKeys([]);
        fetchQueue();
      }
    } catch (error) {
      message.error('清空失败');
    }
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag color={type === 'qsl_label' ? 'blue' : 'green'}>
          {type === 'qsl_label' ? 'QSL 标签' : '地址标签'}
        </Tag>
      ),
    },
    {
      title: 'QSL ID',
      dataIndex: 'qsl_id',
      key: 'qsl_id',
      width: 150,
      render: (text) => text || '-',
    },
    {
      title: '呼号/姓名',
      key: 'callsign_name',
      width: 150,
      render: (_, record) => {
        if (record.type === 'qsl_label') {
          // QSL标签：显示发往的呼号（第一条日志的对方呼号）
          const firstLog = record.logs?.[0];
          return firstLog?.station_callsign || '-'; // 对方呼号存储在station_callsign字段
        } else if (record.type === 'address_label') {
          // 地址标签：显示收信/发信人姓名
          const addressData = record.sender || record.receiver;
          const name = addressData?.name || '-';
          const type = record.sender ? '发信' : '收信';
          return `${name} (${type})`;
        }
        return '-';
      },
    },
    {
      title: '布局',
      dataIndex: 'layout',
      key: 'layout',
      width: 100,
      render: (layout) => {
        if (!layout) return '-';
        return layout === 1 ? 'Layout 1 (TC)' : 'Layout 2 (RC)';
      },
    },
    {
      title: '日志数量',
      key: 'log_count',
      width: 100,
      render: (_, record) => {
        if (record.type === 'qsl_label') {
          // QSL标签：显示实际日志数量
          return record.logs ? record.logs.length : 0;
        } else {
          // 地址标签：不显示日志数量
          return '-';
        }
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'ready' ? 'success' : 'default'}>
          {status === 'ready' ? '就绪' : '准备中'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => formatDateTime(text),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record.id)}
          >
            打印
          </Button>
          <Popconfirm
            title="确定移除吗？"
            onConfirm={() => handleRemove(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      console.log('Selection changed:', newSelectedRowKeys);
      
      if (newSelectedRowKeys.length === 0) {
        // 如果没有选中任何项目，清空类型限制
        setSelectedRowKeys([]);
        setSelectedType(null);
        console.log('Cleared selection and type restriction');
      } else {
        // 检查新选中的项目类型
        const newSelectedItems = queue.filter(item => newSelectedRowKeys.includes(item.id));
        const types = [...new Set(newSelectedItems.map(item => item.type))];
        
        console.log('Selected items types:', types);
        
        if (types.length === 1) {
          // 所有选中项目都是同一类型，允许选择
          setSelectedRowKeys(newSelectedRowKeys);
          setSelectedType(types[0]);
          console.log(`Set selection type to: ${types[0]}`);
        } else {
          // 选中了不同类型的项目，保持原有选择不变
          // 这种情况通常不会发生，因为getCheckboxProps会阻止
          console.warn('Cannot select different types of items');
        }
      }
    },
    getCheckboxProps: (record) => {
      // 如果没有选中任何项目，所有项目都可以选择
      if (selectedType === null) {
        return { disabled: false };
      }
      
      // 如果已经选中了某种类型，只有同类型的项目可以选择
      const isDisabled = record.type !== selectedType;
      return {
        disabled: isDisabled,
      };
    },
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <Title level={3} style={{ margin: 0 }}>
              打印队列
            </Title>
            <Text type="secondary">({queue.length} 项)</Text>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchQueue}>
              刷新
            </Button>
            <Popconfirm
              title="确定清空队列吗？"
              description="这将删除队列中的所有项目"
              onConfirm={handleClearQueue}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<ClearOutlined />}>
                清空队列
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<MergeCellsOutlined />}
            onClick={handleMergeAndPrint}
            disabled={selectedRowKeys.length === 0}
          >
            合并打印{selectedType === 'qsl_label' ? 'QSL标签' : selectedType === 'address_label' ? '地址标签' : ''} ({selectedRowKeys.length})
          </Button>
        </Space>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={queue}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default PrintQueue;
