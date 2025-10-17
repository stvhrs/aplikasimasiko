import React, { useRef, useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Divider } from 'antd';
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../../../constants';

const { Title, Text } = Typography;

const RekapitulasiCard = ({ data }) => {
  const scrollRef = useRef(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  const pemasukanByCategory = data
    .filter(tx => tx.tipe === TipeTransaksi.pemasukan)
    .reduce((acc, tx) => {
      const kategoriNama = KategoriPemasukan[tx.kategori] || tx.kategori;
      acc[kategoriNama] = (acc[kategoriNama] || 0) + tx.jumlah;
      return acc;
    }, {});

  const pengeluaranByCategory = data
    .filter(tx => tx.tipe === TipeTransaksi.pengeluaran)
    .reduce((acc, tx) => {
      const kategoriNama = KategoriPengeluaran[tx.kategori] || tx.kategori;
      acc[kategoriNama] = (acc[kategoriNama] || 0) + Math.abs(tx.jumlah);
      return acc;
    }, {});

  const totalPemasukan = Object.values(pemasukanByCategory).reduce((sum, val) => sum + val, 0);
  const totalPengeluaran = Object.values(pengeluaranByCategory).reduce((sum, val) => sum + val, 0);

  const pemasukanEntries = Object.entries(pemasukanByCategory);
  const pengeluaranEntries = Object.entries(pengeluaranByCategory);

  useEffect(() => {
    const scrollContainer = scrollRef.current;

    const handleScroll = () => {
      if (!scrollContainer) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 1;
      
      setShowTopShadow(scrollTop > 0);
      setShowBottomShadow(!isAtBottom);
    };

    const checkInitialScroll = () => {
      if (scrollContainer) {
        const hasScroll = scrollContainer.scrollHeight > scrollContainer.clientHeight;
        setShowTopShadow(false);
        setShowBottomShadow(hasScroll);
      }
    };

    checkInitialScroll();
    scrollContainer?.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [data]);

  return (
    <Card style={{ height: '100%' }}>
      <Title level={5} style={{ marginTop: 0 }}>Rekapitulasi Filter</Title>
      
      <div style={{ position: 'relative' }}>
        <div style={{
            position: 'absolute', top: 0, left: 0, right: '10px', height: '16px',
            background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.12), transparent)',
            opacity: showTopShadow ? 1 : 0, transition: 'opacity 0.2s ease-in-out',
            zIndex: 1, pointerEvents: 'none',
        }}/>

        <div ref={scrollRef} style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' }}>
          <Title level={5} style={{ color: 'green', marginTop: 12 }}>Pemasukan</Title>
          <Divider style={{ marginTop: 0, marginBottom: 12 }} />
          {pemasukanEntries.length > 0 ? (
            pemasukanEntries.map(([kategori, jumlah], index) => (
              <React.Fragment key={kategori}>
                <Row justify="space-between" style={{ padding: '8px 0' }}>
                  <Col><Text>{kategori}</Text></Col>
                  <Col><Text strong>{currencyFormatter(jumlah)}</Text></Col>
                </Row>
                {index < pemasukanEntries.length - 1 && <Divider style={{ margin: 0 }} />}
              </React.Fragment>
            ))
          ) : <Text type="secondary">Tidak ada pemasukan.</Text>}
          
          <Title level={5} style={{ color: 'red', marginTop: '20px' }}>Pengeluaran</Title>
          <Divider style={{ marginTop: 0, marginBottom: 12 }} />
          {pengeluaranEntries.length > 0 ? (
            pengeluaranEntries.map(([kategori, jumlah], index) => (
              <React.Fragment key={kategori}>
                <Row justify="space-between" style={{ padding: '8px 0' }}>
                  <Col><Text>{kategori}</Text></Col>
                  <Col><Text strong>{currencyFormatter(jumlah)}</Text></Col>
                </Row>
                {index < pengeluaranEntries.length - 1 && <Divider style={{ margin: 0 }} />}
              </React.Fragment>
            ))
          ) : <Text type="secondary">Tidak ada pengeluaran.</Text>}
        </div>

        <div style={{
            position: 'absolute', bottom: 0, left: 0, right: '10px', height: '16px',
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.12), transparent)',
            opacity: showBottomShadow ? 1 : 0, transition: 'opacity 0.2s ease-in-out',
            zIndex: 1, pointerEvents: 'none',
        }}/>
      </div>

      <Divider />
      <Row justify="space-between">
        <Col><Text strong>Total Pemasukan</Text></Col>
        <Col><Text strong style={{ color: 'green' }}>{currencyFormatter(totalPemasukan)}</Text></Col>
      </Row>
      <Row justify="space-between" style={{ marginTop: 8 }}>
        <Col><Text strong>Total Pengeluaran</Text></Col>
        <Col><Text strong style={{ color: 'red' }}>{currencyFormatter(totalPengeluaran)}</Text></Col>
      </Row>
    </Card>
  );
};

export default RekapitulasiCard;

