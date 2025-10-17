import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Input, InputNumber, DatePicker, Radio, Select, Upload, Button, Card, Empty, Typography, Spin,
    message // <-- Ditambahkan
} from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'; // <-- Ditambahkan
import dayjs from 'dayjs';

// --- Impor Firebase ---
import { db, storage } from '../../../api/firebase';
import { ref, push, update, get } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
// --- Akhir Impor Firebase ---

const { Text } = Typography;
const { Option } = Select;

// ====================== CONSTANTS ======================
const TipeTransaksi = {
    pemasukan: 'pemasukan',
    pengeluaran: 'pengeluaran',
};

const KategoriPemasukan = {
    'Penjualan Buku': 'Penjualan Buku',
    'Jasa Cetak Buku': 'Jasa Cetak Buku',
    'Pemasukan Lain-lain': 'Pemasukan Lain-lain',
    'Penjualan Sisa Kertas': 'Penjualan Sisa Kertas',
};

const KategoriPengeluaran = {
    'Operasional': 'Operasional',
    'Gaji': 'Gaji',
    'Pembelian Bahan Baku': 'Pembelian Bahan Baku',
    'Pengeluaran Lain-lain': 'Pengeluaran Lain-lain',
};
const INVOICE_PAYMENT_CATEGORIES = ['Penjualan Buku', 'Jasa Cetak Buku'];

// ====================== UTILITIES ======================
const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

// ====================== COMPONENT ======================
const TransaksiForm = ({
    open,
    onCancel,
    initialValues,
    unpaidJual = [],
    unpaidCetak = [],
    loadingInvoices = false
}) => {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const [selectedTxnDetails, setSelectedTxnDetails] = useState(null);

    // --- State Internal Baru ---
    const [isSaving, setIsSaving] = useState(false);
    const [modal, contextHolder] = Modal.useModal();
    // --- Akhir State Internal Baru ---

    const watchingTipe = Form.useWatch('tipe', form);
    const watchingKategori = Form.useWatch('kategori', form);

    const isInvoicePayment = INVOICE_PAYMENT_CATEGORIES.includes(watchingKategori);

    const payableInvoices = React.useMemo(() => {
        let list = [];
        if (watchingKategori === 'Penjualan Buku') {
            list = unpaidJual.map(tx => ({ ...tx, tipeTransaksi: "Penjualan Buku" }));
        } else if (watchingKategori === 'Jasa Cetak Buku') {
            list = unpaidCetak.map(tx => ({ ...tx, tipeTransaksi: 'Jasa Cetak Buku' }));
        }
        return list.filter(tx => tx.statusPembayaran !== 'Lunas');
    }, [watchingKategori, unpaidJual, unpaidCetak]);

    useEffect(() => {
        if (!open) {
            form.resetFields();
            setFileList([]);
            setSelectedTxnDetails(null);
            return;
        }

        if (initialValues) {
            // --- MODE EDIT ---
            const currentJumlah = Math.abs(initialValues.jumlahBayar || initialValues.jumlah || 0);

            form.setFieldsValue({
                ...initialValues,
                tanggal: initialValues.tanggal ? dayjs(initialValues.tanggal) : dayjs(initialValues.tanggalBayar),
                jumlah: currentJumlah,
                kategori: initialValues.kategori || initialValues.tipeMutasi,
                tipe: initialValues.tipe || 'pemasukan'
            });

            if (initialValues.idTransaksi) {
                const originalTxn = [...unpaidJual, ...unpaidCetak].find(
                    tx => tx.id === initialValues.idTransaksi
                );

                if (originalTxn) {
                    setSelectedTxnDetails({
                        ...originalTxn,
                        jumlahTerbayar: originalTxn.jumlahTerbayar - currentJumlah,
                    });
                } else {
                    const totalTagihanEstimasi = (initialValues.totalTagihan || 0) || currentJumlah + (initialValues.sisaTagihan || 0);
                    setSelectedTxnDetails({
                        nomorInvoice: initialValues.keterangan?.split(' ')[2] || 'Invoice Tidak Ditemukan',
                        namaPelanggan: initialValues.keterangan?.split('(')[1]?.replace(')', '') || 'N/A',
                        totalTagihan: totalTagihanEstimasi,
                        jumlahTerbayar: Math.max(0, totalTagihanEstimasi - currentJumlah),
                    });
                }
            }

            if (initialValues.buktiUrl) {
                setFileList([{ uid: '-1', name: 'File terlampir', status: 'done', url: initialValues.buktiUrl }]);
            }
        } else {
            // --- MODE TAMBAH BARU ---
            form.resetFields();
            form.setFieldsValue({
                tipe: TipeTransaksi.pemasukan,
                tanggal: dayjs(),
                kategori: 'Pemasukan Lain-lain',
            });
        }
    }, [initialValues, open, form, unpaidJual, unpaidCetak]);


    const handleTipeChange = (e) => {
        const newTipe = e.target.value;
        form.setFieldsValue({
            kategori: newTipe === TipeTransaksi.pemasukan ? 'Pemasukan Lain-lain' : 'Operasional',
            idTransaksi: null,
            keterangan: null,
            jumlah: null,
        });
        setSelectedTxnDetails(null);
    };

    const handleKategoriChange = () => {
        form.setFieldsValue({ idTransaksi: null, keterangan: null, jumlah: null });
        setSelectedTxnDetails(null);
    };

    const handleTxnSelect = (selectedId) => {
        const tx = payableInvoices.find(t => t.id === selectedId);
        if (tx) {
            const sisaTagihan = tx.totalTagihan - tx.jumlahTerbayar;
            setSelectedTxnDetails(tx);
            form.setFieldsValue({
                keterangan: `Pembayaran invoice ${tx.nomorInvoice} (${tx.namaPelanggan})`,
                jumlah: sisaTagihan,
                tipeTransaksi: tx.tipeTransaksi,
            });
        }
    };

    const normFile = (e) => (Array.isArray(e) ? e : e && e.fileList);

    // --- LOGIKA FORM DI PINDAH KE SINI ---

    const handleOk = () => {
        form.validateFields()
            .then(values => {
                saveTransaction(values);
            })
            .catch((info) => {
                console.log('Validate Failed:', info);
            });
    };

    const saveTransaction = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan...', key: 'saving' });

        const { bukti, ...dataLain } = values;
        const buktiFile = (bukti && bukti.length > 0 && bukti[0].originFileObj) ? bukti[0].originFileObj : null;
        let buktiUrl = initialValues?.buktiUrl || null;

        try {
            if (buktiFile) {
                const safeKeterangan = (dataLain.keterangan || 'bukti').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
                const originalExt = buktiFile.name.split('.').pop();
                const fileName = `${safeKeterangan}-${uuidv4()}.${originalExt}`;
                const fileRef = storageRef(storage, `bukti_mutasi/${fileName}`);
                await uploadBytes(fileRef, buktiFile, { contentType: buktiFile.type });
                buktiUrl = await getDownloadURL(fileRef);
            } else if (initialValues && !bukti) {
                buktiUrl = null;
            }

            const updates = {};
            const isEditing = !!initialValues;
            const mutasiId = isEditing ? initialValues.id : push(ref(db, 'mutasi')).key;

            let dataToSave = {};
            let oldPaymentAmount = 0;
            let oldInvoiceId = null;
            let oldInvoiceType = null; // 'Penjualan Buku' | 'Jasa Cetak Buku'

            if (isEditing) {
                if (initialValues.idTransaksi) {
                    oldPaymentAmount = Math.abs(initialValues.jumlahBayar || initialValues.jumlah || 0);
                    oldInvoiceId = initialValues.idTransaksi;
                    oldInvoiceType = initialValues.tipeTransaksi;
                }
            }

            if (dataLain.idTransaksi) {
                // --- PEMBAYARAN INVOICE ---
                const newPaymentAmount = Number(dataLain.jumlah);
                dataToSave = { // Data ini akan disimpan di 'mutasi'
                    idTransaksi: dataLain.idTransaksi,
                    tipeTransaksi: dataLain.tipeTransaksi,
                    jumlahBayar: newPaymentAmount,
                    tanggalBayar: dataLain.tanggal.valueOf(),
                    tipeMutasi: dataLain.kategori,
                    keterangan: dataLain.keterangan,
                    buktiUrl,
                    tipe: TipeTransaksi.pemasukan,
                    kategori: dataLain.kategori,
                    jumlah: newPaymentAmount,
                    tanggal: dataLain.tanggal.valueOf(),
                };

                updates[`mutasi/${mutasiId}`] = dataToSave;

                const invoiceDbPath = dataLain.tipeTransaksi === 'Penjualan Buku' ? 'transaksiJualBuku' : 'transaksiCetakBuku';
                const invoiceRef = ref(db, `${invoiceDbPath}/${dataLain.idTransaksi}`);
                const invoiceSnapshot = await get(invoiceRef);
                if (!invoiceSnapshot.exists()) throw new Error("Invoice terkait tidak ditemukan!");

                const invoiceData = invoiceSnapshot.val();
                let currentPaid = invoiceData.jumlahTerbayar || 0;
                let currentHistory = invoiceData.riwayatPembayaran || {};

                // **PERUBAHAN DI SINI: Menambahkan 'keterangan'**
                if (isEditing) {
                    if (oldInvoiceId === dataLain.idTransaksi) {
                        currentPaid = (currentPaid - oldPaymentAmount) + newPaymentAmount;
                        currentHistory[mutasiId] = { 
                            tanggal: dataLain.tanggal.valueOf(), 
                            jumlah: newPaymentAmount, 
                            mutasiId: mutasiId, 
                            keterangan: dataToSave.keterangan // <-- DITAMBAHKAN
                        };
                    } else {
                        if (oldInvoiceId && oldInvoiceType) {
                            const oldInvoiceDbPath = oldInvoiceType === 'Penjualan Buku' ? 'transaksiJualBuku' : 'transaksiCetakBuku';
                            const oldInvoiceRef = ref(db, `${oldInvoiceDbPath}/${oldInvoiceId}`);
                            const oldInvSnapshot = await get(oldInvoiceRef);
                            if (oldInvSnapshot.exists()) {
                                const oldInvData = oldInvSnapshot.val();
                                const oldPaid = (oldInvData.jumlahTerbayar || 0) - oldPaymentAmount;
                                const oldHistory = oldInvData.riwayatPembayaran || {};
                                delete oldHistory[mutasiId];
                                const oldStatus = (oldPaid <= 0) ? 'Belum Bayar' : (oldPaid < oldInvData.totalTagihan) ? 'DP' : 'Lunas';
                                updates[`${oldInvoiceDbPath}/${oldInvoiceId}/jumlahTerbayar`] = oldPaid;
                                updates[`${oldInvoiceDbPath}/${oldInvoiceId}/riwayatPembayaran`] = oldHistory;
                                updates[`${oldInvoiceDbPath}/${oldInvoiceId}/statusPembayaran`] = oldStatus;
                            }
                        }
                        currentPaid = currentPaid + newPaymentAmount;
                        currentHistory[mutasiId] = { 
                            tanggal: dataLain.tanggal.valueOf(), 
                            jumlah: newPaymentAmount, 
                            mutasiId: mutasiId,
                            keterangan: dataToSave.keterangan // <-- DITAMBAHKAN
                        };
                    }
                } else {
                    currentPaid = currentPaid + newPaymentAmount;
                    currentHistory[mutasiId] = { 
                        tanggal: dataLain.tanggal.valueOf(), 
                        jumlah: newPaymentAmount, 
                        mutasiId: mutasiId,
                        keterangan: dataToSave.keterangan // <-- DITAMBAHKAN
                    };
                }
                // **AKHIR PERUBAHAN**

                const newStatus = (currentPaid <= 0) ? 'Belum Bayar' : (currentPaid >= invoiceData.totalTagihan) ? 'Lunas' : 'DP';
                updates[`${invoiceDbPath}/${dataLain.idTransaksi}/jumlahTerbayar`] = currentPaid;
                updates[`${invoiceDbPath}/${dataLain.idTransaksi}/riwayatPembayaran`] = currentHistory;
                updates[`${invoiceDbPath}/${dataLain.idTransaksi}/statusPembayaran`] = newStatus;

            } else {
                // --- MUTASI UMUM (BUKAN INVOICE) ---
                const jumlah = dataLain.tipe === TipeTransaksi.pengeluaran
                    ? -Math.abs(Number(dataLain.jumlah))
                    : Number(dataLain.jumlah);

                dataToSave = {
                    jumlah,
                    kategori: dataLain.kategori,
                    keterangan: dataLain.keterangan,
                    tanggal: dataLain.tanggal.valueOf(),
                    tipe: dataLain.tipe,
                    buktiUrl,
                    tipeMutasi: dataLain.kategori,
                };

                updates[`mutasi/${mutasiId}`] = dataToSave;

                if (isEditing && oldInvoiceId && oldInvoiceType) {
                    const oldInvoiceDbPath = oldInvoiceType === 'Penjualan Buku' ? 'transaksiJualBuku' : 'transaksiCetakBuku';
                    const oldInvoiceRef = ref(db, `${oldInvoiceDbPath}/${oldInvoiceId}`);
                    const oldInvSnapshot = await get(oldInvoiceRef);
                    if (oldInvSnapshot.exists()) {
                        const oldInvData = oldInvSnapshot.val();
                        const oldPaid = (oldInvData.jumlahTerbayar || 0) - oldPaymentAmount;
                        const oldHistory = oldInvData.riwayatPembayaran || {};
                        delete oldHistory[mutasiId];
                        const oldStatus = (oldPaid <= 0) ? 'Belum Bayar' : (oldPaid < oldInvData.totalTagihan) ? 'DP' : 'Lunas';
                        updates[`${oldInvoiceDbPath}/${oldInvoiceId}/jumlahTerbayar`] = oldPaid;
                        updates[`${oldInvoiceDbPath}/${oldInvoiceId}/riwayatPembayaran`] = oldHistory;
                        updates[`${oldInvoiceDbPath}/${oldInvoiceId}/statusPembayaran`] = oldStatus;
                    }
                }
            }

            await update(ref(db), updates);
            message.success({ content: isEditing ? 'Mutasi berhasil diperbarui' : 'Mutasi berhasil ditambahkan', key: 'saving', duration: 2 });
            onCancel();
        } catch (error) {
            console.error("Error saving transaction: ", error);
            message.error({ content: `Terjadi kesalahan: ${error.message}`, key: 'saving', duration: 4 });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (!initialValues) return;

        modal.confirm({
            title: 'Konfirmasi Hapus',
            content: 'Apakah Anda yakin ingin menghapus mutasi ini? Tindakan ini juga akan memperbarui tagihan invoice terkait (jika ada).',
            okText: 'Hapus',
            okType: 'danger',
            cancelText: 'Batal',
            onOk: async () => {
                setIsSaving(true);
                message.loading({ content: 'Menghapus...', key: 'deleting' });
                try {
                    const mutasiId = initialValues.id;
                    const updates = {};

                    updates[`mutasi/${mutasiId}`] = null;

                    if (initialValues.idTransaksi && initialValues.tipeTransaksi) {
                        const paymentAmount = Math.abs(initialValues.jumlahBayar || initialValues.jumlah || 0);
                        const invoiceDbPath = initialValues.tipeTransaksi === 'Penjualan Buku'
                            ? 'transaksiJualBuku'
                            : 'transaksiCetakBuku';
                        const invoiceRef = ref(db, `${invoiceDbPath}/${initialValues.idTransaksi}`);

                        const invoiceSnapshot = await get(invoiceRef);
                        if (invoiceSnapshot.exists()) {
                            const invoiceData = invoiceSnapshot.val();
                            const currentPaid = (invoiceData.jumlahTerbayar || 0) - paymentAmount;
                            const currentHistory = invoiceData.riwayatPembayaran || {};
                            delete currentHistory[mutasiId];

                            const newStatus = (currentPaid <= 0) ? 'Belum Bayar' : (currentPaid >= invoiceData.totalTagihan) ? 'Lunas' : 'DP';

                            updates[`${invoiceDbPath}/${initialValues.idTransaksi}/jumlahTerbayar`] = currentPaid;
                            updates[`${invoiceDbPath}/${initialValues.idTransaksi}/riwayatPembayaran`] = currentHistory;
                            updates[`${invoiceDbPath}/${initialValues.idTransaksi}/statusPembayaran`] = newStatus;
                        }
                    }

                    await update(ref(db), updates);

                    message.success({ content: 'Mutasi berhasil dihapus', key: 'deleting', duration: 2 });
                    onCancel();
                } catch (error) {
                    console.error("Gagal menghapus:", error);
                    message.error({ content: `Gagal menghapus: ${error.message}`, key: 'deleting', duration: 4 });
                } finally {
                    setIsSaving(false);
                }
            },
        });
    };

    return (
        <Modal
            open={open}
            title={initialValues ? 'Edit Pembayaran' : 'Tambah Mutasi'}
            onCancel={onCancel}
            destroyOnClose
            confirmLoading={isSaving}
            footer={[
                contextHolder,
                initialValues && (
                    <Button
                        key="delete"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleDelete}
                        style={{ float: 'left' }}
                        loading={isSaving}
                    >
                        Hapus
                    </Button>
                ),
                <Button key="back" onClick={onCancel} disabled={isSaving}>
                    Batal
                </Button>,
                <Button key="submit" type="primary" loading={isSaving} onClick={handleOk}>
                    Simpan
                </Button>,
            ]}
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
                                disabled={!!initialValues?.idTransaksi}
                                filterOption={(input, option) =>
                                    (option.children?.toLowerCase() || '').includes(input.toLowerCase())
                                }
                                notFoundContent={loadingInvoices ? <Spin size="small" /> : <Empty description="Tidak ada invoice belum lunas" />}
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

                        <Form.Item name="tipeTransaksi" hidden><Input /></Form.Item>

                        {selectedTxnDetails && (
                            <Card size="small" style={{ marginBottom: 16 }} title="Detail Tagihan">
                                <Text strong>No. Invoice:</Text> <Text>{selectedTxnDetails.nomorInvoice}</Text><br />
                                <Text strong>Pelanggan:</Text> <Text>{selectedTxnDetails.namaPelanggan}</Text><br />
                                <Text strong>Total Tagihan:</Text> <Text>{currencyFormatter(selectedTxnDetails.totalTagihan)}</Text><br />
                                <Text strong>Sudah Dibayar (Sebelum Ini):</Text> <Text>{currencyFormatter(selectedTxnDetails.jumlahTerbayar)}</Text><br />
                                <Text type="danger" strong>Sisa Tagihan:</Text> <Text type="danger">{currencyFormatter(selectedTxnDetails.totalTagihan - selectedTxnDetails.jumlahTerbayar)}</Text>
                            </Card>
                        )}

                        <Form.Item name="keterangan" label="Keterangan Pembayaran">
                            <Input.TextArea rows={2} placeholder="Keterangan akan terisi otomatis" />
                        </Form.Item>
                    </>
                ) : (
                    <Form.Item name="keterangan" label="Keterangan" rules={[{ required: true, message: 'Keterangan wajib diisi!' }]}>
                        <Input.TextArea rows={2} placeholder="Masukkan keterangan mutasi" />
                    </Form.Item>
                )}

                <Form.Item
                    name="jumlah"
                    label={isInvoicePayment ? "Jumlah Bayar" : "Jumlah"}
                    rules={[
                        { required: true, message: 'Jumlah wajib diisi!' },
                        { type: 'number', min: 1, message: 'Jumlah harus lebih dari 0' },
                        () => ({
                            validator(_, value) {
                                if (!isInvoicePayment || !selectedTxnDetails || !value) {
                                    return Promise.resolve();
                                }
                                const sisa = selectedTxnDetails.totalTagihan - selectedTxnDetails.jumlahTerbayar;
                                if (value > sisa) {
                                    return Promise.reject(new Error(`Jumlah bayar melebihi sisa tagihan (${currencyFormatter(sisa)})`));
                                }
                                return Promise.resolve();
                            },
                        }),
                    ]}
                >
                    <InputNumber
                        prefix="Rp "
                        style={{ width: '100%' }}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v.replace(/[^\d]/g, '')}
                    />
                </Form.Item>

                <Form.Item label="Bukti Transaksi (Opsional)" name="bukti" valuePropName="fileList" getValueFromEvent={normFile}>
                    <Upload name="bukti" customRequest={({ onSuccess }) => onSuccess("ok")} maxCount={1} fileList={fileList} onChange={({ fileList: newFileList }) => setFileList(newFileList)} accept="image/*,.pdf">
                        <Button icon={<UploadOutlined />}>Pilih File</Button>
                    </Upload>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default TransaksiForm;