import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  message,
  Row,
  Col,
  Typography,
  Divider,
  Tabs,
} from 'antd';
import { PrinterOutlined, SearchOutlined, SaveOutlined } from '@ant-design/icons';
import { addressApi, printApi } from '../api';

const { Title, Text } = Typography;
const { TextArea } = Input;

const AddressLabel = () => {
  const [senderForm] = Form.useForm();
  const [receiverForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [senderDefault, setSenderDefault] = useState(null);

  useEffect(() => {
    fetchSenderDefault();
  }, []);

  const fetchSenderDefault = async () => {
    try {
      const response = await addressApi.getSenderDefault();
      if (response.success && response.data) {
        setSenderDefault(response.data);
        senderForm.setFieldsValue({
          name: response.data.name,
          phone: response.data.phone,
          address: response.data.address,
          postal_code: response.data.postal_code,
          country: response.data.country,
        });
      }
    } catch (error) {
      console.error('Fetch sender default error:', error);
    }
  };

  const handleSearchCallsign = async (callsign) => {
    if (!callsign || !callsign.trim()) {
      message.warning('请输入呼号');
      return;
    }

    try {
      const response = await addressApi.getByCallsign(callsign.trim().toUpperCase());
      if (response.success && response.data) {
        const addr = response.data;
        receiverForm.setFieldsValue({
          name: addr.name,
          phone: addr.phone,
          address: addr.address,
          postal_code: addr.postal_code,
          country: addr.country,
        });
        message.success('地址已自动填充');
      } else {
        message.info('未找到该呼号的地址信息');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        message.info('未找到该呼号的地址信息');
      } else {
        message.error('查询失败');
      }
    }
  };

  const handleSaveSenderDefault = async () => {
    try {
      const values = await senderForm.validateFields();
      console.log('保存发件人默认地址:', values);
      
      const response = await addressApi.updateSenderDefault({
        name: values.name,
        phone: values.phone,
        address: values.address,
        postal_code: values.postal_code,
        country: values.country,
      });

      if (response.success) {
        message.success('发件人默认地址已保存');
        fetchSenderDefault();
      }
    } catch (error) {
      console.error('保存发件人默认地址错误:', error);
      if (error.errorFields) {
        message.error('请填写完整信息');
      } else {
        const errorMsg = error.response?.data?.error || error.message || '保存失败';
        message.error('保存失败: ' + errorMsg);
      }
    }
  };

  const handlePrintSender = async () => {
    try {
      setLoading(true);
      const values = await senderForm.validateFields();

      const response = await printApi.addToQueue({
        type: 'address_label',
        sender: {
          type: 'sender',
          name: values.name,
          phone: values.phone,
          address: values.address,
          postal_code: values.postal_code,
          country: values.country,
        },
      });

      if (response.success) {
        message.success('发信地址标签已添加到打印队列');
      }
    } catch (error) {
      if (error.errorFields) {
        message.error('请填写完整信息');
      } else {
        message.error('添加到打印队列失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceiver = async () => {
    try {
      setLoading(true);
      const values = await receiverForm.validateFields();

      const response = await printApi.addToQueue({
        type: 'address_label',
        receiver: {
          type: 'receiver',
          name: values.name,
          phone: values.phone,
          address: values.address,
          postal_code: values.postal_code,
          country: values.country,
        },
      });

      if (response.success) {
        message.success('收信地址标签已添加到打印队列');
      }
    } catch (error) {
      if (error.errorFields) {
        message.error('请填写完整信息');
      } else {
        message.error('添加到打印队列失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const senderTab = (
    <Card title="发信地址" style={{ marginBottom: 24 }}>
      <Form form={senderForm} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="姓名"
              name="name"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="发件人姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="电话" name="phone">
              <Input placeholder="联系电话（可选）" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="地址"
          name="address"
          rules={[{ required: true, message: '请输入地址' }]}
        >
          <TextArea rows={3} placeholder="详细地址" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="邮编"
              name="postal_code"
              rules={[{ required: true, message: '请输入邮编' }]}
            >
              <Input placeholder="邮政编码" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="国家"
              name="country"
            >
              <Input placeholder="国家/地区（可选）" />
            </Form.Item>
          </Col>
        </Row>

        <Space>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrintSender}
            loading={loading}
          >
            添加到打印队列
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveSenderDefault}
          >
            保存为默认发件人
          </Button>
        </Space>
      </Form>
    </Card>
  );

  const receiverTab = (
    <Card title="收信地址" style={{ marginBottom: 24 }}>
      <Form form={receiverForm} layout="vertical">
        <Form.Item label="快速查询">
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="输入呼号查询地址"
              onPressEnter={(e) => handleSearchCallsign(e.target.value)}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                const callsign = document.querySelector('input[placeholder="输入呼号查询地址"]').value;
                handleSearchCallsign(callsign);
              }}
            >
              查询
            </Button>
          </Space.Compact>
        </Form.Item>

        <Divider />

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="姓名"
              name="name"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="收件人姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="电话" name="phone">
              <Input placeholder="联系电话（可选）" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="地址"
          name="address"
          rules={[{ required: true, message: '请输入地址' }]}
        >
          <TextArea rows={3} placeholder="详细地址" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="邮编"
              name="postal_code"
              rules={[{ required: true, message: '请输入邮编' }]}
            >
              <Input placeholder="邮政编码" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="国家"
              name="country"
            >
              <Input placeholder="国家/地区（可选）" />
            </Form.Item>
          </Col>
        </Row>

        <Button
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrintReceiver}
          loading={loading}
        >
          添加到打印队列
        </Button>
      </Form>
    </Card>
  );

  return (
    <div>
      <Title level={2}>地址标签打印</Title>
      <Text type="secondary">
        可以分别打印发信地址和收信地址标签，支持多次打印
      </Text>

      <Divider />

      <Tabs
        defaultActiveKey="sender"
        items={[
          {
            key: 'sender',
            label: '发信地址',
            children: senderTab,
          },
          {
            key: 'receiver',
            label: '收信地址',
            children: receiverTab,
          },
        ]}
      />
    </div>
  );
};

export default AddressLabel;
