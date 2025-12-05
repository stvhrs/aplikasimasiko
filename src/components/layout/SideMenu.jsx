import React from 'react';
import { Layout, Menu, Button, Typography } from 'antd';
import { Link } from 'react-router-dom';
import {
    BookOutlined,
    SwapOutlined,
    ShoppingCartOutlined,
    TeamOutlined,
    LogoutOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;
const { Text } = Typography;

// ============================
// Navigation Menu Component
// ============================
export const NavigationMenu = ({ activeKey, onLinkClick }) => (
    <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeKey]}
        onClick={onLinkClick}
        items={[
            { key: '/mutasi', icon: <SwapOutlined />, label: <Link to="/mutasi">Mutasi</Link> },
            { key: '/pembayaran', icon: <SwapOutlined />, label: <Link to="/pembayaran">Pembayaran</Link> },

            { key: '/retur', icon: <SwapOutlined />, label: <Link to="/retur">Retur</Link> },

            { key: '/buku', icon: <BookOutlined />, label: <Link to="/buku">Data Buku</Link> },
            { key: '/transaksi-jual', icon: <ShoppingCartOutlined />, label: <Link to="/transaksi-jual">Transaksi Jual</Link> },
            { key: '/pelanggan', icon: <TeamOutlined />, label: <Link to="/pelanggan">Data Pelanggan</Link> },
        ]}
    />
);

// ============================
// Side Menu Component
// ============================
const SideMenu = ({ collapsed, onCollapse, activeKey, onLogout, userEmail }) => {
    return (
        <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={onCollapse}
            width={240}
            style={{
                overflow: 'auto',
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 10,
            }}
        >
            {/* Header Logo */}
            <div
                style={{
                    height: '48px',
                    margin: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                }}
            >
                {!collapsed && (
                    <Text
                        style={{
                            color: 'white',
                            fontSize: '18px',
                            fontWeight: 600,
                        }}
                    >
                        CV Galatama
                    </Text>
                )}
            </div>

            {/* Navigation Menu */}
            <NavigationMenu activeKey={activeKey} onLinkClick={() => {}} />

            {/* Footer (Logout) */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '100%',
                    padding: collapsed ? '10px 8px' : '12px 16px',
                    borderTop: '1px solid #1f1f1f',
                    background: '#001529', // warna dasar antd sider
                    textAlign: 'center',
                }}
            >
                {/* Email User */}
                {!collapsed && userEmail && (
                    <Text
                        style={{
                            color: 'rgba(255, 255, 255, 0.65)',
                            display: 'block',
                            marginBottom: '8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                        title={userEmail}
                    >
                        {userEmail}
                    </Text>
                )}
  {!collapsed && userEmail && (  <Button
                    ghost
                    danger
                    icon={<LogoutOutlined />}
                    onClick={onLogout}
                    style={{
                        width: '100%',
                        borderColor: '#ff4d4f',
                        color: '#ff4d4f',
                        fontWeight: 500,
                    }}
                    title="Logout"
                >
                    {!collapsed && 'Logout'}
                </Button> )}
                {/* Tombol Logout (outline merah) */}
              
            </div>
        </Sider>
    );
};

export default SideMenu;
