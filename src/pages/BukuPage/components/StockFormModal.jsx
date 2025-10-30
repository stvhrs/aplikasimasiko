import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Row, Col, Grid, message, Spin, Alert, Typography, Table, Button } from 'antd';
// (PERUBAHAN) Import 'set' dan 'equalTo'
import { ref, push, serverTimestamp, runTransaction, query, orderByChild, onValue, set, equalTo } from 'firebase/database';
import { db } from '../../../api/firebase';
import { timestampFormatter, numberFormatter } from '../../../utils/formatters';

const { Title, Text } = Typography;

const StokFormModal = ({ open, onCancel, buku }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const screens = Grid.useBreakpoint();

    useEffect(() => {
        if (!open) {
            form.resetFields();
        }
    }, [open, form]);

    // --- Effect untuk memuat riwayat stok dari ROOT collection ---
    useEffect(() => {
        if (open && buku?.id) {
            setHistoryLoading(true);

            // 1. Query ke root 'historiStok'
            // 2. Filter berdasarkan 'bukuId' yang sama dengan buku.id (ID asli buku)
            const bookHistoryRef = query(
                ref(db, 'historiStok'),
                orderByChild('bukuId'),
                equalTo(buku.id) // <-- Memfilter berdasarkan ID asli buku
            );

            const unsubscribe = onValue(bookHistoryRef, (snapshot) => {
                const data = snapshot.val();
                const loadedHistory = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
                
                // 3. Urutkan di sisi klien (client-side)
                loadedHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                
                // 4. Ambil 20 terbaru
                setHistory(loadedHistory.slice(0, 20));
                setHistoryLoading(false);
            }, (error) => {
                console.error("Gagal memuat riwayat buku:", error);
                message.error("Gagal memuat riwayat buku.");
                setHistoryLoading(false);
            });

            return () => unsubscribe();
        } else {
            setHistory([]);
        }
    }, [open, buku?.id]);

    if (!buku) return null;

    // --- handleStokUpdate dipecah menjadi 2 langkah ---
    const handleStokUpdate = async (values) => {
        const { jumlah, keterangan } = values;
        const jumlahNum = Number(jumlah);

        if (isNaN(jumlahNum) || jumlahNum === 0) {
            message.error("Jumlah perubahan harus angka dan tidak boleh 0.");
            return;
        }

        setLoading(true);
        let stokSebelum = 0;
        let stokSesudah = 0;

        try {
            // --- LANGKAH 1: Transaksi Atomik pada STOK BUKU ---
            // Menggunakan ID asli buku (buku.id)
            const bukuRef = ref(db, `buku/${buku.id}`); 
            
            await runTransaction(bukuRef, (currentData) => {
                if (!currentData) {
                    return; // Buku tidak ada
                }

                stokSebelum = Number(currentData.stok) || 0;
                stokSesudah = stokSebelum + jumlahNum;

                return {
                    ...currentData,
                    stok: stokSesudah,
                    updatedAt: serverTimestamp(),
                };
            });

            // --- LANGKAH 2: Tulis ke log historiStok (di root) ---
            // Ini dijalankan HANYA JIKA transaksi di atas berhasil
            const newHistoryRef = push(ref(db, 'historiStok'));
            
            // (PERUBAHAN DISINI)
            const historyData = {
                bukuId: buku.id, // <-- DISIMPAN: ID unik buku (misal: -Oabc...)
                judul: buku.judul || 'N/A',
                kode_buku: buku.kode_buku || 'N/A', // <-- DISIMPAN: Kode buku (misal: "2256")
                penerbit: buku.penerbit || 'N/A',
                perubahan: jumlahNum,
                stokSebelum: stokSebelum,
                stokSesudah: stokSesudah,
                keterangan: keterangan || (jumlahNum > 0 ? 'Stok Masuk' : 'Stok Keluar'),
                timestamp: serverTimestamp(),
            };

            await set(newHistoryRef, historyData);

            message.success(`Stok ${buku.judul} berhasil diperbarui.`);
            onCancel();

        } catch (error) {
            console.error("Stok update error:", error);
            message.error("Gagal memperbarui stok: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    // --- AKHIR PERUBAHAN ---

    // Kolom tabel
    const modalHistoryColumns = [
        { title: 'Waktu', dataIndex: 'timestamp', key: 'timestamp', width: 140, render: timestampFormatter, },
        {
            title: 'Perubahan',
            dataIndex: 'perubahan',
            key: 'perubahan',
            width: 140,
            align: 'right',
            render: (val) => {
                const num = Number(val);
                const color = num > 0 ? '#52c41a' : (num < 0 ? '#f5222d' : '#8c8c8c');
                return (
                    <Text strong style={{ color: color }}>
                        {num > 0 ? '+' : ''}{numberFormatter(val)}
                    </Text>
                )
             }
        },
        { title: 'Stok Sblm', dataIndex: 'stokSebelum', key: 'stokSebelum', width: 80, align: 'right', render: numberFormatter },
        { title: 'Stok Stlh', dataIndex: 'stokSesudah', key: 'stokSesudah', width: 80, align: 'right', render: numberFormatter },
        { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan', ellipsis: true }, 
    ];

    return (
        <Modal
            title={`Update Stok: ${buku?.judul || '...'}`}
            open={open}
            onCancel={onCancel}
            footer={null}
            destroyOnClose
            width={1300}
        >
            <Spin spinning={loading}>
                <Row gutter={24}>
                    {/* Kolom Formulir */}
                    <Col sm={10} xs={24}>
                        <Alert
                            message={`Stok Saat Ini: ${numberFormatter(buku?.stok)}`}
                            type="info"
                            style={{ marginBottom: 16 }}
                        />
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleStokUpdate}
                            initialValues={{ jumlah: null, keterangan: '' }}
                        >
                            <Form.Item
                                name="jumlah"
                                label="Jumlah Perubahan (+/-)"
                                rules={[
                                    { required: true, message: 'Masukkan jumlah perubahan' },
                                    { type: 'number', message: 'Jumlah harus angka' },
                                    { validator: (_, value) => value !== 0 ? Promise.resolve() : Promise.reject(new Error('Jumlah tidak boleh 0')) }
                                ]}
                            >
                                <InputNumber style={{ width: '100%' }} placeholder="Contoh: 50 atau -10" />
                            </Form.Item>
                            <Form.Item
                                name="keterangan"
                                label="Keterangan (Opsional)"
                            >
                                <Input placeholder="Contoh: Koreksi Stok" />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit" block loading={loading}>
                                    Update Stok
                                </Button>
                            </Form.Item>
                        </Form>
                    </Col>

                    {/* Kolom Riwayat Stok Buku Ini */}
                    <Col sm={14} xs={24}>
                        <Title level={5} style={{ marginTop: screens.xs ? 16 : 0, marginBottom: 16 }}>
                            Riwayat Stok Buku Ini (20 Terbaru)
                        </Title>
                        <Table
                            columns={modalHistoryColumns}
                            dataSource={history}
                            loading={historyLoading}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            scroll={{ y: 320 }}
                        />
                    </Col>
                </Row>
            </Spin>
        </Modal>
    );
};

export default StokFormModal;