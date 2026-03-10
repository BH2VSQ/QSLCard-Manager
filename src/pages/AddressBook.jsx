import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Card,
  message,
  Modal,
  Form,
  Popconfirm,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { addressApi } from '../api';

const { Title } = Typography;
const { TextArea } = Input;

const AddressBook = () => {
  const [form] = Form.useForm();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCallsign, setEditingCallsign] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await addressApi.getList({ search: searchText });
      if (response.success) {
        setAddresses(response.data);
      }
    } catch (error) {
      message.error('获取地址列表失败');
      console.error('Fetch addresses error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchAddresses();
  };

  const handleAdd = () => {
    setEditingCallsign(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = async (callsign) => {
    try {
      const response = await addressApi.getByCallsign(callsign);
      if (response.success) {
        setEditingCallsign(callsign);
        form.setFieldsValue(response.data);
        setModalVisible(true);
      }
    } catch (error) {
      message.error('获取地址失败');
    }
  };

  const handleSave = async (values) => {
    try {
      const response = await addressApi.save(values);
      if (response.success) {
        message.success(editingCallsign ? '更新成功' : '添加成功');
        setModalVisible(false);
        form.resetFields();
        fetchAddresses();
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleDelete = async (callsign) => {
    try {
      const response = await addressApi.delete(callsign);
      if (response.success) {
        message.success('删除成功');
        fetchAddresses();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '呼号',
      dataIndex: 'callsign',
      key: 'callsign',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: '邮编',
      dataIndex: 'postal_code',
      key: 'postal_code',
      width: 100,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record.callsign)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个地址吗？"
            onConfirm={() => handleDelete(record.callsign)}
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

  return (
    <div>
      <Card
        title={<Title level={3} style={{ margin: 0 }}>地址库</Title>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加地址
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索呼号或姓名"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 250 }}
          />
          <Button icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchAddresses}>
            刷新
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={addresses}
          rowKey="callsign"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={editingCallsign ? '编辑地址' : '添加地址'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item
            label="呼号"
            name="callsign"
            rules={[{ required: true, message: '请输入呼号' }]}
          >
            <Input
              placeholder="例如: BH1ABC"
              disabled={!!editingCallsign}
              style={{ textTransform: 'uppercase' }}
            />
          </Form.Item>
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="收件人姓名" />
          </Form.Item>
          <Form.Item label="电话" name="phone">
            <Input placeholder="联系电话（可选）" />
          </Form.Item>
          <Form.Item
            label="地址"
            name="address"
            rules={[{ required: true, message: '请输入地址' }]}
          >
            <TextArea rows={3} placeholder="详细地址" />
          </Form.Item>
          <Form.Item label="邮编" name="postal_code">
            <Input placeholder="邮政编码" />
          </Form.Item>
          <Form.Item label="国家" name="country">
            <Input placeholder="国家/地区" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AddressBook;
