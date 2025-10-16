import React, { useState } from 'react';
import { Layout, ConfigProvider, Drawer, Grid, Typography } from 'antd';
import idID from 'antd/locale/id_ID';
import 'dayjs/locale/id';
import { CloseOutlined } from '@ant-design/icons';

import SideMenu, { NavigationMenu } from './components/layout/SideMenu';
import MobileHeader from './components/layout/MobileHeader';
import DashboardPage from './pages/DashboardPage';
import MutasiPage from './pages/MutasiPage';
import HutangPiutangPage from './pages/HutangPiutangPage';
import DataGeneratorPage from './pages/DataGeneratorPage';

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState('2');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const screens = Grid.useBreakpoint();

  const handleMenuSelect = (key) => {
    setCurrentPage(key);
    if (!screens.lg) {
      setDrawerVisible(false);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case '1': return <DashboardPage />;
      case '2': return <MutasiPage />;
      case '3': return <HutangPiutangPage />;
      case '4': return <DataGeneratorPage />;
      default: return <MutasiPage />;
    }
  };

  const contentMarginLeft = collapsed ? 80 : 240;

  return (
    <ConfigProvider locale={idID}>
      <Layout>
        {screens.lg ? (
          <SideMenu
            collapsed={collapsed}
            onCollapse={setCollapsed}
            onMenuSelect={handleMenuSelect}
            activeKey={currentPage}
          />
        ) : (
          <Drawer
            title={<Typography.Text style={{ color: 'white' }}>Menu Navigasi</Typography.Text>}
            placement="left"
            onClose={() => setDrawerVisible(false)}
            open={drawerVisible}
            headerStyle={{ backgroundColor: '#001529', borderBottom: 0 }}
            bodyStyle={{ padding: 0, backgroundColor: '#001529' }}
            closeIcon={<CloseOutlined style={{ color: 'white' }} />}
          >
            <NavigationMenu onMenuSelect={handleMenuSelect} activeKey={currentPage} />
          </Drawer>
        )}
        <Layout style={{
          marginLeft: screens.lg ? contentMarginLeft : 0,
          transition: 'margin-left 0.2s',
          minHeight: '100vh',
        }}>
          {!screens.lg && <MobileHeader onMenuClick={() => setDrawerVisible(true)} />}
          {renderPage()}
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default App;

