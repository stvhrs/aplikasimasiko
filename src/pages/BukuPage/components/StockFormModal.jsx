import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Row, Col, Grid, message, Spin, Alert, Typography, Table ,Button} from 'antd';
// (PERUBAHAN) runTransaction sekarang di-apply ke 'bukuRef', bukan 'bukuStokRef'
import { ref, push, serverTimestamp, runTransaction, query, orderByChild, limitToLast, onValue } from 'firebase/database';
import { db } from '../../../api/firebase'; // Hapus 'storage' jika tidak dipakai
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

    // Effect untuk memuat riwayat stok (Tidak berubah)
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

    // --- (PERUBAHAN BESAR) handleStokUpdate dibuat Atomik ---
    const handleStokUpdate = async (values) => {
        const { jumlah, keterangan } = values;
        const jumlahNum = Number(jumlah);

        // Validasi (Tidak berubah)
        if (isNaN(jumlahNum)) {
             message.error("Jumlah harus berupa angka.");
             return;
        }
         if (jumlahNum === 0) {
             message.error("Jumlah perubahan tidak boleh 0.");
             return;
        }

        setLoading(true);
        try {
            // 1. Tentukan referensi ke node BUKU (bukan hanya stok)
            const bukuRef = ref(db, `buku/${buku.id}`);
            
            // 2. Jalankan Transaksi pada seluruh node buku
            await runTransaction(bukuRef, (currentData) => {
                // currentData adalah seluruh objek buku saat ini
                if (!currentData) {
                    // Buku tidak ada, batalkan transaksi
                    return; 
                }

                // 3. Hitung stok (menggunakan data 'live' dari transaksi)
                const stokSebelum = Number(currentData.stok) || 0;
                const stokSesudah = stokSebelum + jumlahNum;

                // 4. Siapkan data histori (juga pakai data 'live')
                const historyData = {
                    bukuId: buku.id, // atau currentData.id jika ada
                    judul: currentData.judul, // Gunakan data dari transaksi
                    kode_buku: currentData.kode_buku, // Gunakan data dari transaksi
                    perubahan: jumlahNum, // Ini adalah nama field yg benar
                    jumlah: jumlahNum, // (Redundant, tapi ada di kode Anda)
                    keterangan: keterangan || (jumlahNum > 0 ? 'Stok Masuk' : 'Stok Keluar'),
                    stokSebelum: stokSebelum,
                    stokSesudah: stokSesudah,
                    timestamp: serverTimestamp(),
                };
                
                // 5. Buat key baru untuk node historiStok
                const newHistoryKey = push(ref(db, `buku/${buku.id}/historiStok`)).key;

                // 6. Kembalikan data buku yang LENGKAP dan sudah di-update
                return {
                    ...currentData, // Data buku lama
                    stok: stokSesudah, // Stok baru
                    updatedAt: serverTimestamp(), // (PERMINTAAN) Timestamp baru
                    historiStok: {
                        ...currentData.historiStok,
                        [newHistoryKey]: historyData // Tambahkan histori baru
                    }
                };
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
    // --- AKHIR PERUBAHAN ---

    // Kolom untuk tabel riwayat di modal (Tidak berubah)
    const modalHistoryColumns = [
        { title: 'Waktu', dataIndex: 'timestamp', key: 'timestamp', width: 140, render: timestampFormatter, },
        {
            title: 'Perubahan',
            dataIndex: 'perubahan', // Tampilkan data dari field 'perubahan'
            key: 'perubahan',
            width: 100,
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
            width={800}
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