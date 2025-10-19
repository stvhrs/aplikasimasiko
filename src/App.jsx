// App.js (Versi Baru dengan React Router)

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider, Drawer, Grid, Typography } from 'antd';
import idID from 'antd/locale/id_ID';
import 'dayjs/locale/id';
import { CloseOutlined } from '@ant-design/icons';

// --- Komponen Layout ---
import SideMenu, { NavigationMenu } from './components/layout/SideMenu';
import MobileHeader from './components/layout/MobileHeader';

// --- Halaman Aplikasi ---
import BukuPage from './pages/BukuPage/BukuPage';
import MutasiPage from './pages/MutasiPage/MutasiPage';
import TransaksiJualPage from './pages/TransaksiJualPage/TransaksiJualPage'; // Anda menamainya 'TransaksiJualPage', saya asumsikan ini benar
import DataGeneratorPage from './pages/DataGeneratorPage';

// --- Halaman Publik (Dari pembahasan sebelumnya) ---
// Pastikan Anda sudah membuat file-file ini
import InvoicePublicPage from './pages/InvoicePublicPage';
import NotaPublicPage from './pages/NotaPublicPage';
import PelangganPage from './pages/PelangganPage/PelangganPage';


// Komponen baru untuk mengelola layout utama
const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const screens = Grid.useBreakpoint();
  const location = useLocation(); // Hook untuk mendapatkan path URL saat ini

  const handleDrawerClose = () => setDrawerVisible(false);
  const handleMenuClick = () => setDrawerVisible(true);

  // Tentukan menu aktif berdasarkan path URL
  const getActiveKey = () => {
    const path = location.pathname;
    if (path.startsWith('/buku')) return '/buku';
    if (path.startsWith('/mutasi')) return '/mutasi';
    if (path.startsWith('/transaksi-jual')) return '/transaksi-jual';
    if (path.startsWith('/pelanggan')) return '/pelanggan';
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
          // 'onMenuSelect' sudah tidak diperlukan lagi, dihapus
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
          {/* Kirim 'onLinkClick' untuk menutup drawer setelah link diklik */}
          <NavigationMenu activeKey={getActiveKey()} onLinkClick={handleDrawerClose} />
        </Drawer>
      )}
      <Layout style={{
        marginLeft: screens.lg ? contentMarginLeft : 0,
        transition: 'margin-left 0.2s',
        minHeight: '100vh',
      }}>
        {!screens.lg && <MobileHeader onMenuClick={handleMenuClick} />}
        
        {/* Di sinilah halaman-halaman akan dirender oleh Router */}
        <Routes>
          {/* Rute internal aplikasi Anda */}
          <Route path="/buku" element={<BukuPage />} />
          <Route path="/mutasi" element={<MutasiPage />} />
          <Route path="/transaksi-jual" element={<TransaksiJualPage />} />
          <Route path="/data-generator" element={<DataGeneratorPage />} />
          <Route path="/pelanggan" element={<PelangganPage />} />


          {/* Rute default, arahkan ke halaman mutasi */}
          <Route path="/" element={<Navigate to="/mutasi" replace />} />
        </Routes>

      </Layout>
    </Layout>
  );
};


const App = () => {
  return (
    <ConfigProvider locale={idID}>
      <BrowserRouter>
        <Routes>
          {/* Rute untuk halaman publik yang tidak memiliki layout/menu */}
          <Route path="/transaksijualbuku/invoice/:id" element={<InvoicePublicPage />} />
          <Route path="/transaksijualbuku/nota/:id" element={<NotaPublicPage />} />

          {/* Rute untuk semua halaman internal yang menggunakan MainLayout */}
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;