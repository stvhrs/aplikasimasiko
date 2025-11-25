import React from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, Divider, Empty } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, CalendarOutlined, PieChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

dayjs.locale('id');
const { Text, Title } = Typography;

const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const RekapitulasiCard = ({ rekapData, loading, dateRange }) => {
    const { totalPemasukan, totalPengeluaran, pemasukanEntries, pengeluaranEntries } = rekapData;

    const dateText = dateRange && dateRange[0] && dateRange[1]
        ? `${dayjs(dateRange[0]).format('DD MMM')} - ${dayjs(dateRange[1]).format('DD MMM YYYY')}`
        : '...';

    // --- STYLES COMPACT (Kantip) ---
    const cardStyle = {
        padding: '0px 6px 0px 6px', // Standard Kantip Padding

        height: '100%', borderRadius: 4, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        background: '#fff', display: 'flex', flexDirection: 'column'
    };

    const headerStyle = {
        padding: '0px 0px 0px 0px ', // Standard Kantip Padding
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    };

    const summaryBlockStyle = (bgColor, color) => ({
        background: bgColor,
        borderRadius: 4,
        padding: '10px 14px',
        borderLeft: `3px solid ${color}`,
        height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center'
    });

    const listItemStyle = {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0',
        borderBottom: '1px dashed #f5f5f5',
        fontSize: '12px'
    };

    return (
        <Card style={cardStyle} bodyStyle={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Header Compact */}
            <div style={headerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', }}>
                    <div style={styles.iconBox('#1890ff', 'rgba(233, 239, 255, 1)')}>
                           <PieChartOutlined style={{ color: '#1890ff' }} />               </div> 
   <Text strong style={{ fontSize: 14 }}>Ringkasan</Text>   
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>
                    <CalendarOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
                    <Text type="secondary" style={{ fontSize: 14 }}>{dateText}</Text>
                </div>
            </div>

            <Spin spinning={loading}>
                <div style={{ padding: '12px 0' }}>
                    {/* Total Summary */}
                    <Row gutter={[10, 10]}>
                        <Col span={12}>
                            <div style={summaryBlockStyle('#f6ffed', '#52c41a')}>
                                <Text type="secondary" style={{ fontSize: 14 }}>Total Masuk</Text>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#3f8600' }}>
                                    {currencyFormatter(totalPemasukan)}
                                </div>
                            </div>
                        </Col>
                        <Col span={12}>
                            <div style={summaryBlockStyle('#fff1f0', '#cf1322')}>
                                <Text type="secondary" style={{ fontSize: 14 }}>Total Keluar</Text>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#cf1322' }}>
                                    {currencyFormatter(totalPengeluaran)}
                                </div>
                            </div>
                        </Col>
                    </Row>

                    <Divider style={{ margin: '12px 0' }} />

                    {/* List Rincian Scrollable 
                        maxHeight: '135px' -> Estimasi visual untuk menampilkan +/- 4 item 
                        (sekitar 32px per item)
                    */}
                    <div style={{ maxHeight: '135px', overflowY: 'auto', paddingRight: 4 }}>
                        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Rincian Kategori</Text>

                        {pemasukanEntries.length === 0 && pengeluaranEntries.length === 0 && (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Kosong" imageStyle={{ height: 40 }} />
                        )}

                        {pemasukanEntries.map(([key, val]) => val > 0 && (
                            <div key={key} style={listItemStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#52c41a' }}></div>
                                    <Text style={{ color: '#595959', fontSize: 14 }}>{key}</Text>
                                </div>
                                <Text strong style={{ color: '#3f8600', fontSize: 14 }}>{currencyFormatter(val)}</Text>
                            </div>
                        ))}

                        {pengeluaranEntries.map(([key, val]) => val > 0 && (
                            <div key={key} style={listItemStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#cf1322' }}></div>
                                    <Text style={{ color: '#595959', fontSize: 14 }}>{key}</Text>
                                </div>
                                <Text strong style={{ color: '#cf1322', fontSize: 14 }}>{currencyFormatter(val)}</Text>
                            </div>
                        ))}
                    </div>
                </div>
            </Spin>
        </Card>
    );
};

export default RekapitulasiCard;
const styles = {
    pageContainer: {
        padding: '16px', // Agak lebih rapat dari default 24px
        backgroundColor: '#f5f7fa',
        minHeight: '100vh'
    },
    card: {
        borderRadius: 4, // Khas Kantip
        border: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', // Shadow tipis
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Supaya header radius ngikut
        height: '100%'
    },
    headerCompact: {
        padding: '12px 16px', // Padding header khas Kantip
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fff'
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: 600,
        margin: 0,
        color: '#262626'
    },
    iconBox: (color, bg) => ({
        background: bg,
        padding: 6,
        borderRadius: 4,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        fontSize: 14
    }),
    inputRadius: {
        borderRadius: 4
    }
};