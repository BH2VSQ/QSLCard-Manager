import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  PrinterOutlined,
  ContactsOutlined,
  MailOutlined,
  ScanOutlined,
  SearchOutlined,
  SettingOutlined,
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons';
import useThemeStore from '../../store/themeStore';
import './Layout.css';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '日志管理',
    },
    {
      key: '/card-management',
      icon: <ScanOutlined />,
      label: '卡片管理',
    },
    {
      key: '/print-queue',
      icon: <PrinterOutlined />,
      label: '打印队列',
    },
    {
      key: '/address-book',
      icon: <ContactsOutlined />,
      label: '地址库',
    },
    {
      key: '/address-label',
      icon: <MailOutlined />,
      label: '地址标签',
    },
    {
      key: '/inventory',
      icon: <ScanOutlined />,
      label: '出入库管理',
    },
    {
      key: '/scanner',
      icon: <SearchOutlined />,
      label: '手动查询',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme={theme === 'dark' ? 'dark' : 'light'}
        width={220}
      >
        <div className="logo">
          <Title level={4} style={{ color: theme === 'dark' ? '#fff' : '#000', margin: '16px' }}>
            {collapsed ? 'QSL' : 'QSL Manager'}
          </Title>
        </div>
        <Menu
          theme={theme === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: theme === 'dark' ? '#001529' : '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Title level={3} style={{ margin: 0, color: theme === 'dark' ? '#fff' : '#000' }}>
            QSL Card Manager
          </Title>
          <Space>
            <Button
              type="text"
              icon={theme === 'dark' ? <BulbFilled /> : <BulbOutlined />}
              onClick={toggleTheme}
              style={{ color: theme === 'dark' ? '#fff' : '#000' }}
            >
              {theme === 'dark' ? '白天模式' : '暗黑模式'}
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default AppLayout;
