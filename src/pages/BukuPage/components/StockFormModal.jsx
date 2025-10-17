import React, { useState, useEffect } from 'react';
import { 
    Modal, Form, Input, InputNumber, message, Typography, 
    Timeline, Empty 
} from 'antd';
import { db } from '../../../api/firebase';
import { ref, update, push, serverTimestamp } from 'firebase/database';

const { Text, Title } = Typography;

const StokFormModal = ({ open, onCancel, buku }) => {
    const [form] = Form.useForm();
    const [isSaving, setIsSaving] = useState(false);
    const [historiArray, setHistoriArray] = useState([]);

    // -----------------------------------------------------------------
    // --- PERBAIKAN: 'useEffect' dipindahkan ke atas SINI ---
    // --- Semua Hook HARUS dipanggil sebelum pengecekan/return ---
    useEffect(() => {
        // Cek jika modal sedang dibuka dan ada data buku
        if (open && buku && buku.historiStok) {
            // Ubah objek historiStok menjadi array
            const arr = Object.values(buku.historiStok)
                // Urutkan berdasarkan timestamp, terbaru (angka terbesar) di atas
                .sort((a, b) => b.timestamp - a.timestamp); 
            setHistoriArray(arr);
        } else {
            // Kosongkan array jika modal ditutup atau tidak ada data
            setHistoriArray([]);
        }
    }, [open, buku]); // Jalankan ulang jika 'open' atau 'buku' berubah
    // -----------------------------------------------------------------


    // Guard clause (penjaga)
    // Pengecekan ini sekarang aman karena semua Hook (useState, useEffect) sudah dipanggil di atas.
    if (!buku || !buku.id) return null;


    const handleFinishStok = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Memperbarui Stok...', key: 'stok' });

        try {
            const { perubahan, keterangan } = values;
            const stokSebelum = Number(buku.stok || 0);
            const stokSesudah = stokSebelum + Number(perubahan);

            const logEntri = {
                timestamp: serverTimestamp(),
                keterangan,
                perubahan: Number(perubahan),
                stokSebelum,
                stokSesudah
            };

            const logKey = push(ref(db, `buku/${buku.id}/historiStok`)).key;

            const updates = {};
            updates[`buku/${buku.id}/stok`] = stokSesudah;
            updates[`buku/${buku.id}/historiStok/${logKey}`] = logEntri;

            await update(ref(db), updates);

            message.success({ content: 'Stok berhasil diperbarui', key: 'stok' });
            form.resetFields();
            onCancel(); 
        } catch (error) {
            console.error("Error updating stock: ", error);
            message.error({ content: `Gagal memperbarui: ${error.message}`, key: 'stok' });
        } finally {
            setIsSaving(false);
        }
    };

    // Fungsi helper untuk format tanggal
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '...';
        return new Date(timestamp).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Modal
            open={open}
            title="Update Stok Buku"
            onCancel={onCancel}
            onOk={form.submit}
            confirmLoading={isSaving}
            destroyOnClose
            width={600} 
        >
            <Title level={5}>{buku.judul}</Title>
            <Text>Stok Saat Ini: <Text strong>{buku.stok || 0}</Text></Text>

            <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
                Riwayat Stok
            </Title>
            <div 
                style={{ 
                    maxHeight: 250, 
                    overflowY: 'auto', 
                    border: '1px solid #f0f0f0', 
                    padding: '16px', 
                    borderRadius: 8,
                    marginBottom: 24 
                }}
            >
                {historiArray.length > 0 ? (
                    <Timeline>
                        {historiArray.map((item, index) => (
                            <Timeline.Item
                                key={index}
                                color={item.perubahan >= 0 ? 'green' : 'red'}
                            >
                                <Text strong>{item.keterangan}</Text>
                                <div>
                                    <Text 
                                        strong 
                                        style={{ 
                                            color: item.perubahan >= 0 ? '#52c41a' : '#f5222d',
                                            fontSize: 16 
                                        }}
                                    >
                                        {item.perubahan > 0 ? `+${item.perubahan}` : item.perubahan}
                                    </Text>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {`Stok berubah dari ${item.stokSebelum} menjadi ${item.stokSesudah}`}
                                </Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {formatTimestamp(item.timestamp)}
                                </Text>
                            </Timeline.Item>
                        ))}
                    </Timeline>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada riwayat stok" />
                )}
            </div>
            
            <Form form={form} layout="vertical" onFinish={handleFinishStok}>
                <Title level={5} style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                    Input Perubahan Stok
                </Title>
                
                <Form.Item
                    name="perubahan"
                    label="Perubahan Stok"
                    rules={[{ required: true, message: 'Jumlah wajib diisi!' }]}
                    help="Gunakan angka positif (cth: 50) untuk menambah stok, atau angka negatif (cth: -10) untuk mengurangi stok."
                >
                    <InputNumber style={{ width: '100%' }} placeholder="cth: 50 atau -10" />
                </Form.Item>

                <Form.Item
                    name="keterangan"
                    label="Keterangan"
                    rules={[{ required: true, message: 'Keterangan wajib diisi!' }]}
                >
                    <Input placeholder="cth: Stok opname, Retur, Stok awal" />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default StokFormModal;