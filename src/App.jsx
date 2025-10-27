import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'; // Tambahkan useNavigate
import { Layout, ConfigProvider, Drawer, Grid, Typography, App as AntApp, Button, message } from 'antd'; // Tambahkan message
import idID from 'antd/locale/id_ID';
import 'dayjs/locale/id';
import { CloseOutlined, LogoutOutlined } from '@ant-design/icons';

// --- Context and Auth Components ---
import { AuthProvider, useAuth } from './AuthContext'; // Sesuaikan path
import ProtectedRoute from './ProtectedRoute'; // Sesuaikan path

// --- Komponen Layout ---
import SideMenu, { NavigationMenu } from './components/layout/SideMenu';
import MobileHeader from './components/layout/MobileHeader';

// --- Halaman Aplikasi ---
import BukuPage from './pages/BukuPage/BukuPage';
import MutasiPage from './pages/MutasiPage/MutasiPage';
import TransaksiJualPage from './pages/TransaksiJualPage/TransaksiJualPage';
// import DataGeneratorPage from './pages/DataGeneratorPage'; // Hapus jika tidak dipakai
import PelangganPage from './pages/PelangganPage/PelangganPage';
// import JsonUploader from './pages/excel'; // Hapus jika tidak dipakai
// import DataGeneratorTransaksiJual from './pages/data'; // Hapus jika tidak dipakai
import LoginPage from './pages/LoginPage/LoginPage';

// --- Halaman Publik ---
import InvoicePublicPage from './pages/InvoicePublicPage';
import NotaPublicPage from './pages/NotaPublicPage';

// --- (BARU) Impor Halaman Generate ---
// Pastikan Anda sudah membuat file-file ini atau ganti dengan impor yang benar
import GBukuPage from './pages/GBukuPage'; // Contoh path
import GMutasiPage from './pages/GMutasiPage'; // Contoh path
import GJualPage from './pages/GJualPage'; // Contoh path


// Komponen MainLayout (Add Logout Button)
const MainLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const screens = Grid.useBreakpoint();
    const location = useLocation();
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const { message: antdMessage } = AntApp.useApp(); // Gunakan hook antd App untuk message

    const handleDrawerClose = () => setDrawerVisible(false);
    const handleMenuClick = () => setDrawerVisible(true);

    const handleLogout = async () => {
        try {
            await logout();
            console.log("Pengguna logout");
            antdMessage.success("Logout berhasil."); // Notifikasi sukses
            navigate('/login', { replace: true }); // Arahkan ke login
        } catch (error) {
            console.error("Gagal logout:", error);
            antdMessage.error("Gagal logout.");
        }
    };

    // --- (UPDATE) getActiveKey ---
    const getActiveKey = () => {
        const path = location.pathname;
         if (path.startsWith('/buku')) return '/buku';
         if (path.startsWith('/mutasi')) return '/mutasi';
         if (path.startsWith('/transaksi-jual')) return '/transaksi-jual';
         if (path.startsWith('/pelanggan')) return '/pelanggan';
         // Rute baru
         if (path.startsWith('/gbuku')) return '/gbuku';
         if (path.startsWith('/gmutasi')) return '/gmutasi';
         if (path.startsWith('/gjual')) return '/gjual';
         // Rute lama dihapus
         // if (path.startsWith('/json')) return '/json';
         // if (path.startsWith('/mutasi2')) return '/mutasi2';
         // if (path.startsWith('/mutasi3')) return '/mutasi3';
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
                    onLogout={handleLogout}
                    userEmail={currentUser?.email}
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
                    footer={
                        <Button
                            type="primary"
                            danger
                            icon={<LogoutOutlined />}
                            onClick={handleLogout}
                            style={{ width: '100%' }}
                         >
                            Logout ({currentUser?.email?.split('@')[0]}) {/* Tampilkan bagian email sblm @ */}
                        </Button>
                    }
                    footerStyle={{ backgroundColor: '#001529', borderTop: '1px solid #1f1f1f', padding: '10px 16px' }}
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

                 {/* --- (UPDATE) Rute Internal --- */}
                 <Routes>
                      {/* Rute Internal Aplikasi */}
                      <Route path="/buku" element={<BukuPage />} />
                      <Route path="/mutasi" element={<MutasiPage/>} />
                      <Route path="/transaksi-jual" element={<TransaksiJualPage />} />
                      <Route path="/pelanggan" element={<PelangganPage />} />
                      {/* Rute Baru */}
                      <Route path="/gbuku" element={<GBukuPage />} />
                      <Route path="/gmutasi" element={<GMutasiPage />} />
                      <Route path="/gjual" element={<GJualPage />} />
                      {/* Rute Lama Dihapus */}
                      {/* <Route path="/json" element={<JsonUploader />} /> */}
                      {/* <Route path="/mutasi2" element={<DataGeneratorPage />} /> */}
                      {/* <Route path="/mutasi3" element={<DataGeneratorTransaksiJual />} /> */}

                      {/* Rute Default Internal */}
                      <Route path="/" element={<Navigate to="/mutasi" replace />} />
                      {/* Catch-all opsional untuk mengarahkan rute internal yg tidak dikenal */}
                      <Route path="*" element={<Navigate to="/mutasi" replace />} />
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
                {/* Rute Login */}
                <Route path="/login" element={<LoginPage />} />

                {/* Rute Publik */}
                <Route path="/transaksijualbuku/invoice/:id" element={<InvoicePublicPage />} />
                <Route path="/transaksijualbuku/nota/:id" element={<NotaPublicPage />} />

                {/* Rute Internal yang Dilindungi */}
                <Route
                    path="/*" // Mencocokkan semua path lain (rute internal)
                    element={
                        <ProtectedRoute>
                            <MainLayout />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
};


const App = () => {
    return (
        <ConfigProvider locale={idID}>
            <AntApp> {/* Konteks App Ant Design */}
                <AuthProvider> {/* Konteks Autentikasi */}
                    <AppRoutes /> {/* Router Utama */}
                </AuthProvider>
            </AntApp>
        </ConfigProvider>
    );
};

export default App;

