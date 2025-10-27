import React from 'react';
import { Layout, Menu, Button, Typography, Space, Divider } from 'antd';
import { Link } from 'react-router-dom';
import {
    // Import icons used in your NavigationMenu
    // Pastikan ikon ini sudah diimpor jika belum
    BookOutlined, SwapOutlined, ShoppingCartOutlined, TeamOutlined, ExperimentOutlined, LogoutOutlined, DatabaseOutlined // Contoh ikon baru
} from '@ant-design/icons';

const { Sider } = Layout;
const { Text } = Typography;

// Definition menu navigasi
export const NavigationMenu = ({ activeKey, onLinkClick }) => (
    <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeKey]}
        onClick={onLinkClick} // Memicu handler klik link
        items={[
            // Item menu Anda - pastikan key cocok dengan logika getActiveKey di MainLayout
            { key: '/mutasi', icon: <SwapOutlined />, label: <Link to="/mutasi">Mutasi</Link> },
            { key: '/buku', icon: <BookOutlined />, label: <Link to="/buku">Data Buku</Link> },
            { key: '/transaksi-jual', icon: <ShoppingCartOutlined />, label: <Link to="/transaksi-jual">Transaksi Jual</Link> },
            { key: '/pelanggan', icon: <TeamOutlined />, label: <Link to="/pelanggan">Data Pelanggan</Link> },
             { type: 'divider' }, // Pembatas opsional
             // --- Rute Baru ---
            //  { key: '/gbuku', icon: <DatabaseOutlined />, label: <Link to="/gbuku">Generate Buku</Link> },
            //  { key: '/gmutasi', icon: <DatabaseOutlined />, label: <Link to="/gmutasi">Generate Mutasi</Link> },
            //  { key: '/gjual', icon: <DatabaseOutlined />, label: <Link to="/gjual">Generate Jual</Link> },
             // --- Rute Lama Dihapus ---
             // { key: '/json', icon: <ExperimentOutlined />, label: <Link to="/json">Upload JSON Buku</Link> },
             // { key: '/mutasi2', icon: <ExperimentOutlined />, label: <Link to="/mutasi2">Generate Data 1</Link> },
             // { key: '/mutasi3', icon: <ExperimentOutlined />, label: <Link to="/mutasi3">Generate Data 2</Link> },
        ]}
    />
);


const SideMenu = ({ collapsed, onCollapse, activeKey, onLogout, userEmail }) => {
    return (
        <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={onCollapse}
            width={240} // Lebar ditambah
            style={{
                overflow: 'auto',
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 10, // Pastikan di atas konten
            }}
        >
            <div style={{ height: '32px', margin: '16px', display: 'flex', alignItems: 'left', justifyContent: 'left' }}>
                {/* Opsional: Tambahkan Logo */}
                {/* <img src="/path/to/logo.png" alt="Logo" style={{ height: 32, filter: 'brightness(0) invert(1)' }} /> */}
                 {!collapsed && <Text style={{ color: 'white', fontSize: '18px', marginLeft: '8px' }}>CV Galatama</Text>}
            </div>

            <NavigationMenu activeKey={activeKey} />

            {/* Bagian Logout di bawah */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                padding: collapsed ? '10px 0' : '10px 16px', // Sesuaikan padding saat collapsed
                textAlign: 'center',
                 borderTop: '1px solid #1f1f1f'
            }}>
                {!collapsed && userEmail && (
                    <Text style={{ color: 'rgba(255, 255, 255, 0.65)', display: 'block', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userEmail}>
                        {userEmail}
                    </Text>
                )}
                <Button
                    type="primary"
                    danger
                    icon={<LogoutOutlined />}
                    onClick={onLogout}
                    style={{ width: '100%' }}
                    title="Logout" // Tooltip untuk state collapsed
                >
                    {!collapsed && 'Logout'} {/* Sembunyikan teks saat collapsed */}
                </Button>
            </div>
        </Sider>
    );
};

export default SideMenu;

