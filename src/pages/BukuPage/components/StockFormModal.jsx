import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Row, Col, Grid, message, Spin, Alert, Typography, Table ,Button} from 'antd';
import { ref, push, serverTimestamp, runTransaction, query, orderByChild, limitToLast, onValue } from 'firebase/database';
import { db, storage } from '../../../api/firebase';
import { timestampFormatter, numberFormatter } from '../../../utils/formatters'; // Impor formatters
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

    // Effect untuk memuat riwayat stok buku ini (Tidak berubah)
    useEffect(() => {
        if (open && buku?.id) {
            setHistoryLoading(true);
            const bookHistoryRef = query(
                ref(db, `buku/${buku.id}/historiStok`),
                orderByChild('timestamp'),
                limitToLast(20)
            );

            const unsubscribe = onValue(bookHistoryRef, (snapshot) => {
                const data = snapshot.val();
                const loadedHistory = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
                loadedHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setHistory(loadedHistory);
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

    const handleStokUpdate = async (values) => {
        const { jumlah, keterangan } = values;
        const jumlahNum = Number(jumlah);
        if (isNaN(jumlahNum)) { // Validasi lebih ketat
             message.error("Jumlah harus berupa angka.");
             return;
        }
         if (jumlahNum === 0) { // Validasi tidak boleh 0
             message.error("Jumlah perubahan tidak boleh 0.");
             return;
        }


        setLoading(true);
        try {
            const stokSebelum = Number(buku.stok) || 0;
            const stokSesudah = stokSebelum + jumlahNum;

            // --- PERBAIKAN: Tambahkan 'perubahan' ---
            const historyData = {
                bukuId: buku.id,
                judul: buku.judul,
                kode_buku: buku.kode_buku,
                jumlah: jumlahNum, // Ini adalah jumlah perubahan
                perubahan: jumlahNum, // <-- TAMBAHKAN INI LAGI
                keterangan: keterangan || (jumlahNum > 0 ? 'Stok Masuk' : 'Stok Keluar'),
                stokSebelum: stokSebelum, // Stok sebelum perubahan
                stokSesudah: stokSesudah, // Stok setelah perubahan
                timestamp: serverTimestamp(),
            };
            // --- AKHIR PERBAIKAN ---
            console.log("Saving history data:", historyData); // DEBUG

            // 1. Catat HANYA ke riwayat stok BUKU
            const bookHistoryRef = ref(db, `buku/${buku.id}/historiStok`);
            await push(bookHistoryRef, historyData);

            // 2. Update stok di buku menggunakan Transaksi
            const bukuStokRef = ref(db, `buku/${buku.id}/stok`);
            await runTransaction(bukuStokRef, (currentStok) => {
                 const currentNum = Number(currentStok) || 0; // Pastikan angka
                return currentNum + jumlahNum; // Update stok
            });

            message.success(`Stok ${buku.judul} berhasil diperbarui.`);
            onCancel(); // Tutup modal setelah sukses
        } catch (error) {
            console.error("Stok update error:", error);
            message.error("Gagal memperbarui stok: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Kolom untuk tabel riwayat di modal (Tidak berubah)
    const modalHistoryColumns = [
        { title: 'Waktu', dataIndex: 'timestamp', key: 'timestamp', width: 140, render: timestampFormatter, },
        {
            title: 'Perubahan', // Ganti judul kolom dari 'Jumlah' menjadi 'Perubahan' agar konsisten
            dataIndex: 'perubahan', // Tampilkan data dari field 'perubahan'
            key: 'perubahan', // Key juga ganti
            width: 100, // Lebar bisa disesuaikan
            align: 'right',
            render: (val) => { /* ... logika render warna ... */
                const num = Number(val);
                const color = num > 0 ? '#52c41a' : (num < 0 ? '#f5222d' : '#8c8c8c');
                return (
                    <Text strong style={{ color: color }}>
                        {num > 0 ? '+' : ''}{numberFormatter(val)}
                    </Text>
                )
             }
        },
         // Jika masih ingin menampilkan 'jumlah' (meskipun mungkin redundant):
         // { title: 'Jumlah Sblm', dataIndex: 'stokSebelum', key: 'stokSebelum', width: 80, align: 'right', render: numberFormatter },
         // { title: 'Jumlah Stlh', dataIndex: 'stokSesudah', key: 'stokSesudah', width: 80, align: 'right', render: numberFormatter },
        { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan', ellipsis: true }, // Tambah ellipsis
    ];

    return (
        <Modal
            title={`Update Stok: ${buku?.judul || '...'}`} // Gunakan optional chaining
            open={open}
            onCancel={onCancel}
            footer={null}
            destroyOnClose
            width={800}
        >
            <Spin spinning={loading}>
                <Row gutter={24}>
                    {/* Kolom Formulir */}
                    <Col sm={10} xs={24}>
                        <Alert
                            message={`Stok Saat Ini: ${numberFormatter(buku?.stok)}`} // Optional chaining
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
                                label="Jumlah Perubahan (+/-)" // Ubah label agar lebih jelas
                                rules={[
                                    { required: true, message: 'Masukkan jumlah perubahan' },
                                    { type: 'number', message: 'Jumlah harus angka' },
                                    { validator: (_, value) => value !== 0 ? Promise.resolve() : Promise.reject(new Error('Jumlah tidak boleh 0')) } // Validasi tidak boleh 0
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
                                <Button type="primary" htmlType="submit" block loading={loading}> {/* Tambah state loading di button */}
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