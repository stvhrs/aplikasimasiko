import React, { useRef, useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Divider, Tag, Space } from 'antd'; // Tambahkan Tag dan Space jika KategoriChips ada di sini
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../../../constants';
// Pastikan path ke formatters benar
import { currencyFormatter } from '../../../utils/formatters'; 

const { Title, Text } = Typography;

const RekapitulasiCard = ({ rekapData, isFilterActive }) => {
    const scrollRef = useRef(null);
    const [showTopShadow, setShowTopShadow] = useState(false);
    const [showBottomShadow, setShowBottomShadow] = useState(false);

    // Ambil data dari prop
    const { pemasukanEntries = [], pengeluaranEntries = [], totalPemasukan = 0, totalPengeluaran = 0 } = rekapData || {};

    // Efek untuk shadow scroll
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
        
        // Cek ulang saat data berubah
        checkInitialScroll(); 

        return () => { scrollContainer?.removeEventListener('scroll', handleScroll); };
     }, [rekapData]); // Dependensi pada rekapData

    return (
        <Card style={{ height: '100%' }}>
            {/* Judul dinamis berdasarkan filter */}
            <Title level={5} style={{ marginTop: 0 }}>
                Rekapitulasi {isFilterActive ? '(Hasil Filter)' : '(Semua Transaksi)'}
            </Title>

            <div style={{ position: 'relative' }}>
                {/* Top Shadow */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: '10px', height: '16px', background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.12), transparent)', opacity: showTopShadow ? 1 : 0, transition: 'opacity 0.2s ease-in-out', zIndex: 1, pointerEvents: 'none', }}/>

                {/* Konten Scrollable */}
                <div ref={scrollRef} style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' }}>
                    <Title level={5} style={{ color: 'green', marginTop: 12 }}>Pemasukan</Title>
                    <Divider style={{ marginTop: 0, marginBottom: 12 }} />
                    {pemasukanEntries.length > 0 ? (
                        pemasukanEntries.map(([kategori, jumlah], index) => (
                            <React.Fragment key={`${kategori}-${index}`}> {/* Key lebih unik */}
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
                             <React.Fragment key={`${kategori}-${index}`}> {/* Key lebih unik */}
                                <Row justify="space-between" style={{ padding: '8px 0' }}>
                                    <Col><Text>{kategori}</Text></Col>
                                    {/* Jumlah pengeluaran sudah positif, formatter akan menanganinya */}
                                    <Col><Text strong>{currencyFormatter(jumlah)}</Text></Col>
                                </Row>
                                {index < pengeluaranEntries.length - 1 && <Divider style={{ margin: 0 }} />}
                            </React.Fragment>
                        ))
                    ) : <Text type="secondary">Tidak ada pengeluaran.</Text>}
                </div>

                {/* Bottom Shadow */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: '10px', height: '16px', background: 'linear-gradient(to top, rgba(0, 0, 0, 0.12), transparent)', opacity: showBottomShadow ? 1 : 0, transition: 'opacity 0.2s ease-in-out', zIndex: 1, pointerEvents: 'none', }}/>
            </div>

            <Divider />
            <Row justify="space-between">
                <Col><Text strong>Total Pemasukan</Text></Col>
                <Col><Text strong style={{ color: 'green' }}>{currencyFormatter(totalPemasukan)}</Text></Col>
            </Row>
            <Row justify="space-between" style={{ marginTop: 8 }}>
                <Col><Text strong>Total Pengeluaran</Text></Col>
                {/* totalPengeluaran sudah positif */}
                <Col><Text strong style={{ color: 'red' }}>{currencyFormatter(totalPengeluaran)}</Text></Col>
            </Row>
             {/* Tambahkan Selisih */}
             <Divider style={{marginTop: 12, marginBottom: 12}}/>
             <Row justify="space-between" style={{ marginTop: 8 }}>
                <Col><Text strong>Selisih</Text></Col>
                {/* Logika selisih sekarang benar (totalPemasukan - totalPengeluaran) */}
                <Col><Text strong style={{ color: (totalPemasukan - totalPengeluaran) >= 0 ? 'green' : 'red' }}>{currencyFormatter(totalPemasukan - totalPengeluaran)}</Text></Col>
            </Row>
        </Card>
    );
};

// --- Komponen KategoriChips (Pindahkan ke file terpisah) ---
// Hapus ini dari RekapitulasiCard.js jika sudah ada di MutasiPage.js
// const chipStyle = { border: '1px solid #d9d9d9', padding: '4px 10px', borderRadius: '16px', minWidth: '130px', textAlign: 'center' };
// const KategoriChips = ({ kategoriMap, onSelect, selectedKategori }) => (
//  <Space wrap>
//      {Object.entries(kategoriMap).map(([key, value]) => (
//          <Tag.CheckableTag
//              key={key}
//              checked={selectedKategori.includes(key)}
//              onChange={() => onSelect('selectedKategori', key)}
//              style={chipStyle}
//          >
//              {value}
//          </Tag.CheckableTag>
//      ))}
//  </Space>
// );
export default RekapitulasiCard;