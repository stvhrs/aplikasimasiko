import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import {
  DashboardOutlined, SwapOutlined, MoneyCollectOutlined, ToolOutlined,
  BookFilled
} from '@ant-design/icons';

const { Sider } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '1', icon: <BookFilled />, label: 'Data Buku' },
  { key: '2', icon: <SwapOutlined />, label: 'Mutasi' },
  { key: '3', icon: <SwapOutlined />, label: 'Penjualan Buku' },
 
  { type: 'divider' },
  { key: '4', icon: <ToolOutlined />, label: 'Generator Data' },
];

export const NavigationMenu = ({ onMenuSelect, activeKey }) => (
  <Menu
    theme="dark"
    selectedKeys={[activeKey]}
    mode="inline"
    items={menuItems}
    onClick={({ key }) => onMenuSelect(key)}
  />
);

const SideMenu = ({ collapsed, onCollapse, onMenuSelect, activeKey }) => {
  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      width={240}
      collapsedWidth={80}
      theme="dark"
      // Apply styles to fix the Sider and make it scroll independently
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 10, // Ensure sider stays on top
      }}
    >
      <div
        style={{
          height: 32,
          margin: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <MoneyCollectOutlined style={{ fontSize: '24px', color: 'white' }}/>
        {!collapsed && <Title level={5} style={{ marginBottom: 0, color: 'white' }}>Mas Iko Finance</Title>}
      </div>
      <NavigationMenu onMenuSelect={onMenuSelect} activeKey={activeKey} />
    </Sider>
  );
};

export default SideMenu;
