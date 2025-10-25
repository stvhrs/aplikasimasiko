// ================================
// FILE: src/App.js (FIXED)
// PERUBAHAN:
// 1. Impor 'App as AntApp' dari 'antd'
// 2. Bungkus <AppRoutes /> dengan <AntApp>
// ================================

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
// Impor 'App as AntApp' dari 'antd'
import { Layout, ConfigProvider, Drawer, Grid, Typography, App as AntApp } from 'antd';
import idID from 'antd/locale/id_ID';
import 'dayjs/locale/id';
import { CloseOutlined } from '@ant-design/icons';

// --- Komponen Layout ---
import SideMenu, { NavigationMenu } from './components/layout/SideMenu';
import MobileHeader from './components/layout/MobileHeader';

// --- Halaman Aplikasi ---
import BukuPage from './pages/BukuPage/BukuPage';
import MutasiPage from './pages/MutasiPage/MutasiPage';
import TransaksiJualPage from './pages/TransaksiJualPage/TransaksiJualPage';
import DataGeneratorPage from './pages/DataGeneratorPage';

// --- Halaman Publik ---
import InvoicePublicPage from './pages/InvoicePublicPage';
import NotaPublicPage from './pages/NotaPublicPage';
import PelangganPage from './pages/PelangganPage/PelangganPage';
import JsonUploader from './pages/excel';
import DataGeneratorTransaksiJual from './pages/data';


// Komponen MainLayout (tidak berubah)
const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const screens = Grid.useBreakpoint();
  const location = useLocation();

  const handleDrawerClose = () => setDrawerVisible(false);
  const handleMenuClick = () => setDrawerVisible(true);

  const getActiveKey = () => {
    const path = location.pathname;
    if (path.startsWith('/buku')) return '/buku';
    if (path.startsWith('/mutasi')) return '/mutasi';
    if (path.startsWith('/transaksi-jual')) return '/transaksi-jual';
    if (path.startsWith('/pelanggan')) return '/pelanggan';
    if (path.startsWith('/mutasi3')) return '/mutasi3';
    if (path.startsWith('/mutasi2')) return '/mutasi2';



    return '/mutasi'; // Default
  };

  const contentMarginLeft = collapsed ? 80 : 240;

  return (
    <Layout>
      {screens.lg ? (
        <SideMenu
          collapsed={collapsed}
          onCollapse={setCollapsed}
          activeKey={getActiveKey()}
        />
      ) : (
        <Drawer
          title={<Typography.Text style={{ color: 'white' }}>Menu Navigasi</Typography.Text>}
          placement="left"
          onClose={handleDrawerClose}
          open={drawerVisible}
          headerStyle={{ backgroundColor: '#001529', borderBottom: 0 }}
          bodyStyle={{ padding: 0, backgroundColor: '#001529' }}
          closeIcon={<CloseOutlined style={{ color: 'white' }} />}
        >
          <NavigationMenu activeKey={getActiveKey()} onLinkClick={handleDrawerClose} />
        </Drawer>
      )}
      <Layout style={{
        marginLeft: screens.lg ? contentMarginLeft : 0,
        transition: 'margin-left 0.2s',
        minHeight: '100vh',
      }}>
        {!screens.lg && <MobileHeader onMenuClick={handleMenuClick} />}
        
        <Routes>
    
          {/* Rute internal aplikasi Anda */}
          <Route path="/buku" element={<BukuPage />} />
          <Route path="/mutasi" element={<MutasiPage/>} />
          <Route path="/transaksi-jual" element={<TransaksiJualPage />} />
          <Route path="/data-generator" element={<DataGeneratorPage />} />
          <Route path="/pelanggan" element={<PelangganPage />} />
          <Route path="/json" element={<JsonUploader />} />
          <Route path="/mutasi2" element={<DataGeneratorPage />} />
          <Route path="/mutasi3" element={<DataGeneratorTransaksiJual />} />




          {/* Rute default, arahkan ke halaman mutasi */}
          <Route path="/" element={<Navigate to="/mutasi" replace />} />
        </Routes>

      </Layout>
    </Layout>
  );
};

// Pisahkan Router ke komponennya sendiri
const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rute untuk halaman publik yang tidak memiliki layout/menu */}
        <Route path="/transaksijualbuku/invoice/:id" element={<InvoicePublicPage />} />
        <Route path="/transaksijualbuku/nota/:id" element={<NotaPublicPage />} />

        {/* Rute untuk semua halaman internal yang menggunakan MainLayout */}
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </BrowserRouter>
  );
};


const App = () => {
  return (
    <ConfigProvider locale={idID}>
      {/* --- BUNGKUS DENGAN ANTAPP --- */}
      <AntApp>
        <AppRoutes />
      </AntApp>
      {/* --------------------------- */}
    </ConfigProvider>
  );
};

export default App;