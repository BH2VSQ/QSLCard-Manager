import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import LogManagement from './pages/LogManagement';
import LogEditor from './pages/LogEditor';
import PrintQueue from './pages/PrintQueue';
import AddressBook from './pages/AddressBook';
import AddressLabel from './pages/AddressLabel';
import Inventory from './pages/Inventory';
import Scanner from './pages/Scanner';
import CardManagement from './pages/CardManagement';
import Settings from './pages/Settings';
import useThemeStore from './store/themeStore';

function App() {
  const { theme: currentTheme } = useThemeStore();

  // 应用主题到 document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  return (
    <ConfigProvider
      theme={{
        algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#3498db',
          borderRadius: 4,
        },
      }}
    >
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="logs" element={<LogManagement />} />
          <Route path="logs/new" element={<LogEditor />} />
          <Route path="logs/edit/:id" element={<LogEditor />} />
          <Route path="print-queue" element={<PrintQueue />} />
          <Route path="address-book" element={<AddressBook />} />
          <Route path="address-label" element={<AddressLabel />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="card-management" element={<CardManagement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ConfigProvider>
  );
}

export default App;
