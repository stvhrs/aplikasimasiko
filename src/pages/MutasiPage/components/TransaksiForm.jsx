import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal, Form, Input, InputNumber, DatePicker, Radio, Select, Upload, Button, Card, Empty, Typography, Spin
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../../../constants';

const { Text } = Typography;
const { Option } = Select;

// ====================== UTILITIES ======================
const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

// ====================== COMPONENT ======================
const TransaksiForm = ({
    open,
    onCancel,
    onFinish,
    initialValues,
    loading,
    // --- PROPS BARU ---
    unpaidJual = [],     // <-- Prop baru: Array transaksi jual belum lunas
    unpaidCetak = [],    // <-- Prop baru: Array transaksi cetak belum lunas
    loadingInvoices = false // <-- Prop baru: boolean status loading
}) => {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const [selectedTxnDetails, setSelectedTxnDetails] = useState(null);

    // Gunakan Form.useWatch untuk melacak perubahan form secara reaktif
    const watchingTipe = Form.useWatch('tipe', form);
    const watchingKategori = Form.useWatch('kategori', form);

    // isInvoicePayment haruslah reaktif terhadap watchingKategori.
    // Menggunakan useMemo agar perhitungan hanya dilakukan jika watchingKategori berubah.
    // Ini sudah benar dan akan "berubah" nilainya.
    const isInvoicePayment = useMemo(() => {
        return watchingKategori === 'Penjualan Buku' || watchingKategori === 'Jasa Cetak Buku';
    }, [watchingKategori]);

    // Gabungkan daftar invoice yang bisa dibayar berdasarkan kategori
    const payableInvoices = useMemo(() => {
        let list = [];
        if (watchingKategori === 'Penjualan Buku') {
            // Asumsi tipeTransaksi di objek yang dikembalikan dari API adalah "Penjualan Buku"
            list = unpaidJual.map(tx => ({ ...tx, tipeTransaksi: "Penjualan Buku" }));
        } else if (watchingKategori === 'Jasa Cetak Buku') {
            // Asumsi tipeTransaksi di objek yang dikembalikan dari API adalah "Jasa Cetak Buku"
            list = unpaidCetak.map(tx => ({ ...tx, tipeTransaksi: 'Jasa Cetak Buku' }));
        }
        // Pastikan filter di sini juga, jika data dari parent belum terfilter
        return list.filter(tx => tx.statusPembayaran !== 'Lunas');
    }, [watchingKategori, unpaidJual, unpaidCetak]);

    // Efek untuk inisialisasi/reset form saat modal dibuka/ditutup atau initialValues berubah
    useEffect(() => {
        // Reset state lokal setiap kali modal dibuka atau initialValues berubah
        setSelectedTxnDetails(null);
        setFileList([]);
        form.setFieldsValue({
            idTransaksi: null,
            keterangan: null,
            jumlah: null,
        });

        if (open && initialValues) {
            // --- MODE EDIT ---
            form.setFieldsValue({
                ...initialValues,
                tanggal: initialValues.tanggal ? dayjs(initialValues.tanggal) : dayjs(),
                jumlah: Math.abs(initialValues.jumlah || 0),
                // Penting: Atur `kategori` berdasarkan `tipeMutasi` dari `initialValues` jika ada
                // Atau default ke kategori umum jika tidak ada atau tidak relevan
                kategori: initialValues.tipeMutasi || 'Pemasukan Lain-lain', // Default yang lebih aman
            });

            if (initialValues.idTransaksi) {
                // Saat edit, cari invoice asli dari list yang tersedia
                const originalTxn = [...unpaidJual, ...unpaidCetak].find(
                    tx => tx.id === initialValues.idTransaksi
                );
                if (originalTxn) {
                    // Hitung jumlahTerbayar sebelum transaksi yang sedang diedit ini
                    setSelectedTxnDetails({
                        ...originalTxn,
                        jumlahTerbayar: originalTxn.jumlahTerbayar - Math.abs(initialValues.jumlah),
                    });
                } else {
                    // Fallback jika invoice asli tidak ditemukan (mungkin sudah lunas)
                    setSelectedTxnDetails({
                        nomorInvoice: initialValues.keterangan?.split(' ')[2] || 'Invoice Tidak Ditemukan',
                        totalTagihan: initialValues.totalTagihan || initialValues.jumlah + initialValues.jumlahTerbayar || 0, // Estimasi totalTagihan
                        jumlahTerbayar: (initialValues.totalTagihan || 0) - Math.abs(initialValues.jumlah),
                    });
                }
            }

            if (initialValues.buktiUrl) {
                setFileList([{ uid: '-1', name: 'File terlampir', status: 'done', url: initialValues.buktiUrl }]);
            }
        } else if (open) {
            // --- MODE TAMBAH BARU ---
            form.resetFields(); // Pastikan semua field benar-benar di-reset
            form.setFieldsValue({
                tipe: TipeTransaksi.pemasukan,
                tanggal: dayjs(),
                kategori: 'Pemasukan Lain-lain', // Default ke kategori umum untuk pemasukan baru
            });
        }
    }, [initialValues, form, open, unpaidJual, unpaidCetak]); // Tambahkan dependencies yang relevan

    // Handler saat tipe (Pemasukan/Pengeluaran) berubah
    const handleTipeChange = (e) => {
        const newTipe = e.target.value;
        // Atur kategori default yang lebih netral atau relevan dengan mutasi umum
        // Ini memastikan isInvoicePayment menjadi false secara default saat tipe berubah
        form.setFieldsValue({
            kategori: newTipe === TipeTransaksi.pemasukan ? 'Pemasukan Lain-lain' : 'Operasional',
            idTransaksi: null,
            keterangan: null,
            jumlah: null,
        });
        setSelectedTxnDetails(null);
    };

    // Handler saat kategori berubah
    const handleKategoriChange = () => {
        // Reset pilihan invoice dan detail
        form.setFieldsValue({ idTransaksi: null, keterangan: null, jumlah: null });
        setSelectedTxnDetails(null);
    };

    // Handler saat invoice dipilih dari dropdown
    const handleTxnSelect = (selectedId) => {
        const tx = payableInvoices.find(t => t.id === selectedId);
        if (tx) {
            const sisaTagihan = tx.totalTagihan - tx.jumlahTerbayar;
            setSelectedTxnDetails(tx);
            form.setFieldsValue({
                keterangan: `Pembayaran invoice ${tx.nomorInvoice} (${tx.namaPelanggan})`,
                jumlah: sisaTagihan, // Auto-fill dengan sisa tagihan
                tipeTransaksi: tx.tipeTransaksi,
            });
        }
    };

    // Handler untuk upload file
    const normFile = (e) => (Array.isArray(e) ? e : e && e.fileList);
    const handleUploadChange = ({ fileList: newFileList }) => setFileList(newFileList);

    // Menangani submit form
    const handleOk = () => {
        form.validateFields()
            .then(values => {
                const finalValues = { ...values };

                if (isInvoicePayment) {
                    finalValues.tipeMutasi = finalValues.kategori; // Simpan "Penjualan Buku" / "Jasa Cetak Buku" sebagai tipeMutasi
                    // Kategori general ledger tidak diperlukan jika ini pembayaran invoice
                    delete finalValues.kategori;
                } else {
                    finalValues.tipeMutasi = finalValues.kategori; // Untuk mutasi umum, kategori = tipeMutasi
                    delete finalValues.idTransaksi;
                    delete finalValues.tipeTransaksi;
                    // kategori tidak dihapus jika ini mutasi umum, karena itulah kategori GL-nya
                    // atau bisa dihapus jika `tipeMutasi` sudah menggantikannya
                    delete finalValues.kategori;
                }
                onFinish(finalValues);
            })
            .catch(() => {});
    };

    return (
        <Modal
            open={open}
            title={initialValues ? 'Edit Pembayaran' : 'Tambah Mutasi'}
            okText="Simpan"
            cancelText="Batal"
            onCancel={onCancel}
            onOk={handleOk}
            destroyOnClose
            confirmLoading={loading}
            // forceRender // Biasanya tidak diperlukan jika useEffect dan useWatch sudah benar
        >
            <Form form={form} layout="vertical" name="transaksi_form">
                <Form.Item name="tanggal" label="Tanggal Pembayaran" rules={[{ required: true, message: 'Tanggal wajib diisi!' }]}>
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="tipe" label="Tipe Transaksi">
                    <Radio.Group onChange={handleTipeChange} disabled={!!initialValues?.idTransaksi}>
                        <Radio.Button value={TipeTransaksi.pemasukan}>Pemasukan</Radio.Button>
                        <Radio.Button value={TipeTransaksi.pengeluaran}>Pengeluaran</Radio.Button>
                    </Radio.Group>
                </Form.Item>

                <Form.Item name="kategori" label="Kategori" rules={[{ required: true, message: 'Kategori wajib diisi!' }]}>
                    <Select placeholder="Pilih kategori" onChange={handleKategoriChange} disabled={!!initialValues?.idTransaksi}>
                        {(watchingTipe === TipeTransaksi.pemasukan ? Object.entries(KategoriPemasukan) : Object.entries(KategoriPengeluaran))
                            .map(([key, value]) => (<Option key={key} value={key}>{value}</Option>))}
                    </Select>
                </Form.Item>

                {/* --- BLOK KONDISIONAL UNTUK PEMBAYARAN INVOICE --- */}
                {isInvoicePayment ? (
                    <>
                        <Form.Item
                            name="idTransaksi"
                            label="Pilih Invoice"
                            rules={[{ required: true, message: 'Invoice wajib dipilih!' }]}
                        >
                            <Select
                                showSearch
                                placeholder="Cari No. Invoice atau Nama Pelanggan"
                                loading={loadingInvoices}
                                onSelect={handleTxnSelect}
                                disabled={!!initialValues?.idTransaksi} // Nonaktifkan jika mode edit
                                filterOption={(input, option) =>
                                    option.children.toLowerCase().includes(input.toLowerCase())
                                }
                                notFoundContent={loadingInvoices ? <Spin size="small" /> : <Empty description="Tidak ada invoice belum lunas" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                            >
                                {payableInvoices.map(tx => {
                                    const sisaTagihan = tx.totalTagihan - tx.jumlahTerbayar;
                                    return (
                                        <Option key={tx.id} value={tx.id}>
                                            {`${tx.nomorInvoice} - ${tx.namaPelanggan} (Sisa: ${currencyFormatter(sisaTagihan)})`}
                                        </Option>
                                    );
                                })}
                            </Select>
                        </Form.Item>

                        {/* Field tersembunyi untuk menyimpan tipe (jual/cetak) */}
                        <Form.Item name="tipeTransaksi" hidden><Input /></Form.Item>

                        {/* Detail Transaksi (Read-Only) */}
                        {selectedTxnDetails && (
                            <Card size="small" style={{ marginBottom: 16 }} title="Detail Tagihan">
                                <Text strong>No. Invoice:</Text> <Text>{selectedTxnDetails.nomorInvoice}</Text><br/>
                                <Text strong>Pelanggan:</Text> <Text>{selectedTxnDetails.namaPelanggan}</Text><br/>
                                <Text strong>Total Tagihan:</Text> <Text>{currencyFormatter(selectedTxnDetails.totalTagihan)}</Text><br/>
                                <Text strong>Sudah Dibayar (Sebelum Ini):</Text> <Text>{currencyFormatter(selectedTxnDetails.jumlahTerbayar)}</Text><br/>
                                <Text type="danger" strong>Sisa Tagihan:</Text> <Text type="danger">{currencyFormatter(selectedTxnDetails.totalTagihan - selectedTxnDetails.jumlahTerbayar)}</Text>
                            </Card>
                        )}
                        
                        <Form.Item name="keterangan" label="Keterangan Pembayaran">
                            <Input.TextArea rows={2} placeholder="Keterangan akan terisi otomatis" />
                        </Form.Item>
                    </>
                ) : (
                    // BLOK UNTUK MUTASI UMUM (NON-INVOICE)
                    <Form.Item name="keterangan" label="Keterangan" rules={[{ required: true, message: 'Keterangan wajib diisi!' }]}>
                        <Input.TextArea rows={2} />
                    </Form.Item>
                )}
                
                {/* --- FIELD JUMLAH --- */}
                <Form.Item
                    name="jumlah"
                    label={isInvoicePayment ? "Jumlah Bayar" : "Jumlah"}
                    rules={[
                        { required: true, message: 'Jumlah wajib diisi!' },
                        { type: 'number', min: 1, message: 'Jumlah harus lebih dari 0' },
                        ( ) => ({
                            validator(_, value) {
                                if (!isInvoicePayment || !selectedTxnDetails || !value) {
                                    return Promise.resolve();
                                }
                                // `selectedTxnDetails.jumlahTerbayar` sudah disesuaikan untuk mode edit
                                const sisa = selectedTxnDetails.totalTagihan - selectedTxnDetails.jumlahTerbayar;
                                if (value > sisa) {
                                    return Promise.reject(new Error(`Jumlah bayar tidak boleh melebihi sisa tagihan (${currencyFormatter(sisa)})`));
                                }
                                return Promise.resolve();
                            },
                        }),
                    ]}
                    help={isInvoicePayment && selectedTxnDetails ? 
                          `Sisa tagihan yang harus dibayar: ${currencyFormatter(selectedTxnDetails.totalTagihan - selectedTxnDetails.jumlahTerbayar)}` 
                          : null}
                >
                    <InputNumber
                        prefix="Rp "
                        style={{ width: '100%' }}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v.replace(/[^\d]/g, '')}
                    />
                </Form.Item>

                {/* --- FIELD BUKTI --- */}
                <Form.Item label="Bukti Transaksi (Opsional)" name="bukti" valuePropName="fileList" getValueFromEvent={normFile}>
                    <Upload name="bukti" customRequest={({ onSuccess }) => onSuccess("ok")} maxCount={1} fileList={fileList} onChange={handleUploadChange} accept="image/*,.pdf">
                        <Button icon={<UploadOutlined />}>Pilih File</Button>
                    </Upload>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default TransaksiForm;