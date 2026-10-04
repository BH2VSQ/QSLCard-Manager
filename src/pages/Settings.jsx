import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  List,
  Tag,
  message,
  Modal,
  Divider,
  Typography,
  Switch,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  WarningOutlined,
  ReloadOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { configApi, updateApi } from '../api';
import useThemeStore from '../store/themeStore';

const { Title, Text } = Typography;

const Settings = () => {
  const [form] = Form.useForm();
  const [callsigns, setCallsigns] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const { theme, toggleTheme } = useThemeStore();

  // 自动更新相关状态
  const [updateRepo, setUpdateRepo] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, callsignsRes] = await Promise.all([
        configApi.getConfig(),
        configApi.getCallsigns(),
      ]);

      if (configRes.success) {
        setConfig(configRes.data);
        setUpdateRepo(configRes.data.update_repo || '');
      } else {
        console.error('Failed to fetch config:', configRes);
      }

      if (callsignsRes.success) {
        setCallsigns(callsignsRes.data);
      } else {
        console.error('Failed to fetch callsigns:', callsignsRes);
      }
    } catch (error) {
      console.error('Fetch settings error:', error);
      message.error('获取设置失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCallsign = async (values) => {
    try {
      const response = await configApi.addCallsign(values.callsign);
      if (response.success) {
        message.success('呼号添加成功');
        setAddModalVisible(false);
        form.resetFields();
        // 直接添加到本地状态
        setCallsigns(prev => [...prev, values.callsign.toUpperCase()]);
      }
    } catch (error) {
      console.error('Add callsign error:', error);
      if (error.response?.status === 409) {
        message.error('呼号已存在');
      } else {
        message.error('添加失败: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleDeleteCallsign = async (callsign) => {
    try {
      const response = await configApi.deleteCallsign(callsign);
      if (response.success) {
        message.success('呼号删除成功');
        // 直接从本地状态删除
        setCallsigns(prev => prev.filter(c => c !== callsign));
        // 如果删除的是主呼号，清除主呼号设置
        if (config.primary_callsign === callsign) {
          setConfig(prev => ({ ...prev, primary_callsign: '' }));
        }
      }
    } catch (error) {
      console.error('Delete callsign error:', error);
      message.error('删除失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSetPrimary = async (callsign) => {
    try {
      const response = await configApi.setPrimaryCallsign(callsign);
      if (response.success) {
        message.success('主要呼号设置成功');
        // 直接更新本地状态，避免重新获取数据导致的闪烁
        setConfig(prev => ({ ...prev, primary_callsign: callsign }));
      }
    } catch (error) {
      console.error('Set primary callsign error:', error);
      message.error('设置失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleResetQslData = () => {
    Modal.confirm({
      title: '危险操作 - 完全重置数据库',
      icon: <WarningOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p style={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: '16px' }}>
            ⚠️ 此操作将完全清空数据库！
          </p>
          <p>将删除以下所有数据：</p>
          <ul>
            <li>所有日志记录</li>
            <li>所有 QSL 卡片记录</li>
            <li>所有日志与卡片的关联</li>
            <li>所有呼号记录</li>
            <li>主要呼号配置</li>
          </ul>
          <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
            此操作不可恢复！数据库将恢复到初始状态。
          </p>
          <p style={{ marginTop: 16 }}>
            请输入密码 <strong>"admin"</strong> 确认：
          </p>
          <Input.Password
            id="reset-password"
            placeholder="输入密码确认"
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: '确认重置',
      okType: 'danger',
      cancelText: '取消',
      width: 500,
      onOk: async () => {
        const password = document.getElementById('reset-password').value;
        if (!password) {
          message.error('请输入密码');
          return Promise.reject();
        }

        try {
          const response = await configApi.resetQslData(password);
          if (response.success) {
            message.success('数据库已完全重置，页面即将刷新...');
            // 延迟1秒后刷新页面，让用户看到成功消息
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        } catch (error) {
          console.error('Reset database error:', error);
          if (error.response?.status === 403) {
            message.error('密码错误');
          } else {
            message.error('重置失败: ' + (error.response?.data?.error || error.message));
          }
          return Promise.reject();
        }
      },
    });
  };

  const handleImportDatabase = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      Modal.confirm({
        title: '导入 Python 数据库',
        icon: <WarningOutlined style={{ color: '#faad14' }} />,
        content: (
          <div>
            <p>即将导入数据库文件: <strong>{file.name}</strong></p>
            <p>导入操作将：</p>
            <ul>
              <li>保留现有数据</li>
              <li>导入 Python 版本的日志、呼号、QSL 卡片数据</li>
              <li>自动转换 QSL 状态（已出库/入库的卡片保持状态）</li>
              <li>保留原有的出入库时间</li>
            </ul>
            <p style={{ color: '#faad14' }}>
              建议在导入前备份当前数据库！
            </p>
          </div>
        ),
        okText: '确认导入',
        cancelText: '取消',
        onOk: async () => {
          const hide = message.loading('正在导入数据库...', 0);
          try {
            const response = await configApi.importPythonDatabase(file);
            hide();
            if (response.success) {
              message.success('数据库导入成功！页面即将刷新...');
              // 延迟1秒后刷新页面
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }
          } catch (error) {
            hide();
            console.error('Import database error:', error);
            message.error('导入失败: ' + (error.response?.data?.error || error.message));
            return Promise.reject();
          }
        },
      });
    };
    input.click();
  };

  const handleSaveUpdateRepo = async () => {
    try {
      const response = await configApi.updateConfig({ update_repo: updateRepo.trim() });
      if (response.success) {
        setConfig((prev) => ({ ...prev, update_repo: response.data.update_repo }));
        message.success('更新库地址已保存');
      }
    } catch (error) {
      message.error('保存失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCheckUpdate = async () => {
    try {
      setCheckingUpdate(true);
      const response = await updateApi.check();
      if (response.success) {
        setUpdateInfo(response.data);
        if (response.data.has_update) {
          message.info(`发现新版本 v${response.data.latest_version}`);
        } else if (response.data.error) {
          message.warning(response.data.error);
        } else {
          message.success('当前已是最新版本');
        }
      }
    } catch (error) {
      message.error('检查更新失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = () => {
    Modal.confirm({
      title: '确认更新',
      icon: <CloudDownloadOutlined />,
      content: '更新将执行 git pull 并重启服务，期间服务会短暂中断。确定继续吗？',
      okText: '立即更新',
      cancelText: '取消',
      onOk: async () => {
        try {
          setApplyingUpdate(true);
          const response = await updateApi.apply();
          if (response.success) {
            message.success(response.message || '更新完成，服务即将重启...');
            // 等待服务重启后刷新页面
            setTimeout(() => {
              window.location.reload();
            }, 4000);
          }
        } catch (error) {
          message.error('更新失败: ' + (error.response?.data?.error || error.message));
        } finally {
          setApplyingUpdate(false);
        }
      },
    });
  };

  return (
    <div>
      <Title level={2}>设置</Title>

      {/* 主题设置 */}
      <Card title="外观设置" style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong>暗黑模式</Text>
              <br />
              <Text type="secondary">切换应用主题颜色</Text>
            </div>
            <Switch
              checked={theme === 'dark'}
              onChange={toggleTheme}
              checkedChildren="暗黑"
              unCheckedChildren="白天"
            />
          </div>
        </Space>
      </Card>

      {/* 呼号管理 */}
      <Card
        title="呼号管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            添加呼号
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <List
          loading={loading}
          dataSource={callsigns}
          renderItem={(callsign) => (
            <List.Item
              actions={[
                <Button
                  type="link"
                  icon={
                    config.primary_callsign === callsign ? (
                      <StarFilled style={{ color: '#faad14' }} />
                    ) : (
                      <StarOutlined />
                    )
                  }
                  onClick={() => handleSetPrimary(callsign)}
                >
                  {config.primary_callsign === callsign ? '主要' : '设为主要'}
                </Button>,
                <Popconfirm
                  title="确定删除这个呼号吗？"
                  onConfirm={() => handleDeleteCallsign(callsign)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="link" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{callsign}</Text>
                    {config.primary_callsign === callsign && (
                      <Tag color="gold">主要呼号</Tag>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无呼号，请添加' }}
        />
      </Card>

      {/* 自动更新 */}
      <Card title="自动更新" style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>更新库地址</Text>
            <br />
            <Text type="secondary">GitHub 仓库地址，用于查询最新 release 版本</Text>
          </div>
          <Input.Search
            value={updateRepo}
            onChange={(e) => setUpdateRepo(e.target.value)}
            onSearch={handleSaveUpdateRepo}
            enterButton="保存"
            placeholder="https://github.com/BH2VSQ/QSLCard-Manager"
          />
          <Divider style={{ margin: '8px 0' }} />
          <Space wrap>
            <Text>
              当前版本：<Text strong>{updateInfo?.current_version || '未知'}</Text>
            </Text>
            {updateInfo?.latest_version && (
              <Text>
                最新版本：<Text strong>{updateInfo.latest_version}</Text>
              </Text>
            )}
            {updateInfo?.has_update && <Tag color="green">有新版本可用</Tag>}
          </Space>
          {updateInfo?.release_notes && (
            <div>
              <Text strong>更新内容：</Text>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  marginTop: 4,
                  marginBottom: 0,
                  maxHeight: 160,
                  overflow: 'auto',
                  background: 'var(--bg-secondary)',
                  padding: 8,
                  borderRadius: 4,
                }}
              >
                {updateInfo.release_notes}
              </pre>
            </div>
          )}
          <Space>
            <Button icon={<ReloadOutlined />} loading={checkingUpdate} onClick={handleCheckUpdate}>
              检查更新
            </Button>
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              loading={applyingUpdate}
              disabled={!updateInfo?.has_update}
              onClick={handleApplyUpdate}
            >
              立即更新
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 危险区域 */}
      <Card title={<Text type="danger">危险区域</Text>}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>导入 Python 数据库</Text>
            <br />
            <Text type="secondary">
              从 Python 版本导入数据库文件（.db），自动转换为新版本格式。
              已出库/入库的卡片将保持状态，保留原有的出入库时间。
            </Text>
            <br />
            <Button
              type="primary"
              onClick={handleImportDatabase}
              style={{ marginTop: 8 }}
            >
              导入数据库
            </Button>
          </div>
          
          <Divider />
          
          <div>
            <Text strong>重置数据库</Text>
            <br />
            <Text type="secondary">
              完全清空数据库，删除所有日志、QSL 卡片数据和关联。数据库将恢复到初始状态。此操作不可恢复！
            </Text>
            <br />
            <Button
              danger
              icon={<WarningOutlined />}
              onClick={handleResetQslData}
              style={{ marginTop: 8 }}
            >
              重置数据库
            </Button>
          </div>
        </Space>
      </Card>

      {/* 添加呼号对话框 */}
      <Modal
        title="添加呼号"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} onFinish={handleAddCallsign} layout="vertical">
          <Form.Item
            label="呼号"
            name="callsign"
            rules={[
              { required: true, message: '请输入呼号' },
              { pattern: /^[A-Z0-9]+$/, message: '呼号只能包含大写字母和数字' },
            ]}
          >
            <Input
              placeholder="例如: BH1ABC"
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
              <Button
                onClick={() => {
                  setAddModalVisible(false);
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

export default Settings;
