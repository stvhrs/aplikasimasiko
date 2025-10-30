 
import React from 'react';
import { Layout, Button, Typography,  } from 'antd';
import { MenuOutlined } from '@ant-design/icons';

const { Header } = Layout;
const { Title } = Typography;

const MobileHeader = ({ onMenuClick }) => (
  <Header style={{ display: 'flex', alignItems: 'center', padding: '0 16px', backgroundColor: '#001529' }}>
    <Button type="text" icon={<MenuOutlined style={{ color: 'white' }} />} onClick={onMenuClick} />
    <Title level={5} style={{ color: 'white', margin: '0 0 0 16px' }}>Galatama Finance</Title>
  </Header>

  
);

export default MobileHeader;