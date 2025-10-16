 
import React from 'react';
import { Layout, Typography } from 'antd';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const HutangPiutangPage = () => (
  <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>
    <Title level={3}>Hutang/Piutang</Title>
    <Paragraph type="secondary">Halaman ini sedang dalam pengembangan.</Paragraph>
  </Content>
);

export default HutangPiutangPage;