// Di dalam file SideMenu.jsx
import React from 'react';
import { Link } from 'react-router-dom'; // <-- 1. IMPORT Link
import { Layout, Menu } from 'antd';
import {
  BookOutlined,
  SwapOutlined,
  ExperimentOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

// Ini adalah komponen Menu yang akan dipakai di Sider dan Drawer
export const NavigationMenu = ({ activeKey, onLinkClick }) => {
  const handleMenuClick = () => {
    if (onLinkClick) {
      onLinkClick(); // Panggil fungsi untuk menutup drawer di mobile
    }
  };

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[activeKey]} // 'selectedKeys' lebih tepat untuk ini
      onClick={handleMenuClick}
    >
      <Menu.Item key="/buku" icon={<BookOutlined />}>
        {/* 2. BUNGKUS DENGAN <Link> */}
        <Link to="/buku">Data Buku</Link>
      </Menu.Item>
      <Menu.Item key="/mutasi" icon={<SwapOutlined />}>
        <Link to="/mutasi">Mutasi</Link>
      </Menu.Item>
      <Menu.Item key="/transaksi-jual" icon={<ShoppingCartOutlined />}>
        <Link to="/transaksi-jual">Transaksi Jual</Link>
      </Menu.Item>
      <Menu.Item key="/pelanggan" icon={<ExperimentOutlined />}>
        <Link to="/pelanggan">Data Pelanggan</Link>
      </Menu.Item>
     
    </Menu>
  );
};


// Komponen Sider utama untuk desktop
const SideMenu = ({ collapsed, onCollapse, activeKey }) => {
  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        
        left: 0,
        top: 0,
        bottom: 0,
      }}
      width={240}
    >
      <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', lineHeight: '32px', color: 'white' }}>
        {collapsed ? 'AMI' : 'Aplikasi Mas Iko'}
      </div>

      {/* 3. GUNAKAN NavigationMenu, 'onMenuSelect' sudah tidak ada */}
      <NavigationMenu activeKey={activeKey} />

    </Sider>
  );
};

export default SideMenu;