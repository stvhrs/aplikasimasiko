// ================================
// FILE: src/pages/transaksi-jual/components/TransaksiJualForm.jsx
// - Supports mode: 'create' | 'edit'
// - Edit: prefill form, tidak auto-generate invoice, ada tombol Hapus di bawah
// - Create: kurangi stok + tulis histori stok
// - Item: subtotal auto (read-only), header kolom, Grand Total & Total Qty
// - Harga Satuan: formatter/parser Rupiah (IDR) di InputNumber
// ================================

import React, { useEffect, useState } from 'react';
import {
  Form, Input, InputNumber, Select, Button, Space, DatePicker, message, Typography,
  Row, Col, Spin, Popconfirm, Divider, Card, Statistic
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { db } from '../../../api/firebase';
import {
  ref, update, remove, serverTimestamp,
  query, orderByKey, startAt, endAt, get, push
} from 'firebase/database';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;

// ---------- Helpers: Rupiah Formatter / Parser ----------
const rupiahFormatter = (v) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const rupiahParser = (v) => {
  // ambil hanya digit agar aman (hilangkan Rp, titik, spasi, dll)
  const digits = String(v || '0').replace(/[^\d]/g, '');
  return Number(digits || 0);
};

export default function TransaksiJualForm({
  mode = 'create',
  initialTx = null,
  bukuList = [],
  pelangganList = [],
  onSuccess
}) {
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPelanggan, setSelectedPelanggan] = useState(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(mode === 'create');

  // ===== Prefill saat EDIT =====
  useEffect(() => {
    if (mode === 'edit' && initialTx) {
      const p = pelangganList.find((x) => x.id === initialTx.idPelanggan) || null;
      setSelectedPelanggan(p);
      form.setFieldsValue({
        nomorInvoice: initialTx.nomorInvoice || initialTx.id,
        tanggal: initialTx.tanggal ? dayjs(initialTx.tanggal) : dayjs(),
        idPelanggan: initialTx.idPelanggan,
        keterangan: initialTx.keterangan || '',
        items: (initialTx.items || []).map((it) => ({
          idBuku: it.idBuku,
          jumlah: it.jumlah,
          hargaSatuan: it.hargaSatuan,     // numeric
          diskonPersen: it.diskonPersen || 0
        })),
      });
    }
  }, [mode, initialTx, pelangganList, form]);

  // ===== Generate nomor invoice saat CREATE =====
  useEffect(() => {
    if (mode !== 'create') return;
    const generateInvoiceNumber = async () => {
      setIsGeneratingInvoice(true);
      const now = dayjs();
      const year = now.format('YYYY');
      const month = now.format('MM');
      const keyPrefix = `INV-${year}-${month}-`;

      const txRef = ref(db, 'transaksiJualBuku');
      const qy = query(txRef, orderByKey(), startAt(keyPrefix), endAt(keyPrefix + '\uf8ff'));

      try {
        const snapshot = await get(qy);
        let nextNum = 1;
        if (snapshot.exists()) {
          const keys = Object.keys(snapshot.val());
          // keys sudah terurut lexicographically berkat orderByKey
          const lastKey = keys[keys.length - 1];
          const lastNumStr = lastKey.split('-').pop();
          nextNum = parseInt(lastNumStr, 10) + 1;
        }
        const newNumStr = String(nextNum).padStart(4, '0');
        const displayInvoice = `INV/${year}/${month}/${newNumStr}`;
        form.setFieldsValue({ nomorInvoice: displayInvoice });
      } catch (e) {
        console.error(e);
        message.error('Gagal membuat nomor invoice. Coba lagi.');
      } finally {
        setIsGeneratingInvoice(false);
      }
    };
    generateInvoiceNumber();
  }, [mode, form]);

  // ===== Helper harga otomatis =====
  const getHargaOtomatis = (idBuku, pelanggan) => {
    const buku = bukuList.find((b) => b.id === idBuku);
    if (!buku) return { hargaSatuan: 0, diskonPersen: 0 };
    const isSpesial = pelanggan?.isSpesial || false;
    return {
      hargaSatuan: (isSpesial ? buku.hargaJualSpesial : buku.hargaJual) || 0,
      diskonPersen: (isSpesial ? buku.diskonJualSpesial : buku.diskonJual) || 0,
    };
  };

  const handlePelangganChange = (idPelanggan) => {
    const pel = pelangganList.find((p) => p.id === idPelanggan) || null;
    setSelectedPelanggan(pel);
    const items = form.getFieldValue('items') || [];
    const newItems = items.map((item) => {
      if (!item || !item.idBuku) return item;
      const { hargaSatuan, diskonPersen } = getHargaOtomatis(item.idBuku, pel);
      return { ...item, hargaSatuan, diskonPersen };
    });
    form.setFieldsValue({ items: newItems });
  };

  const handleBukuChange = (index, idBuku) => {
    const { hargaSatuan, diskonPersen } = getHargaOtomatis(idBuku, selectedPelanggan);
    const items = form.getFieldValue('items') || [];
    items[index] = { ...items[index], idBuku, hargaSatuan, diskonPersen };
    form.setFieldsValue({ items: [...items] });
  };

  // ===== Submit =====
  const handleFinish = async (values) => {
    setIsSaving(true);
    message.loading({ content: 'Menyimpan Transaksi...', key: 'tx' });
    try {
      const { idPelanggan, items, ...data } = values;
      if (!data.nomorInvoice) throw new Error('Nomor Invoice tidak valid.');

      // key untuk create (INV/.. -> INV-..), untuk edit gunakan existing id
      const txKey = mode === 'create' ? data.nomorInvoice.replace(/\//g, '-') : initialTx.id;

      if (!items || items.length === 0) throw new Error('Transaksi harus memiliki minimal 1 item buku.');
      const pelanggan = pelangganList.find((p) => p.id === idPelanggan);
      if (!pelanggan) throw new Error('Pelanggan tidak valid.');

      let totalTagihan = 0;
      let totalQty = 0;
      const processedItems = items.map((item) => {
        const buku = bukuList.find((b) => b.id === item.idBuku);
        if (!buku) throw new Error(`Buku ${item.idBuku} tidak ditemukan`);
        const hargaSatuan = Number(item.hargaSatuan || 0);
        const diskonPersen = Number(item.diskonPersen || 0);
        const jumlah = Number(item.jumlah || 0);
        const hargaFinal = hargaSatuan * (1 - diskonPersen / 100) * jumlah;
        totalQty += jumlah;
        totalTagihan += hargaFinal;
        return { idBuku: item.idBuku, judulBuku: buku.judul, jumlah, hargaSatuan, diskonPersen };
      });

      const baseTx = {
        nomorInvoice: data.nomorInvoice,
        tanggal: data.tanggal.valueOf(),
        idPelanggan,
        namaPelanggan: pelanggan.nama,
        pelangganIsSpesial: pelanggan.isSpesial || false,
        items: processedItems,
        totalTagihan,
        totalQty,
        keterangan: data.keterangan || '',
      };

      if (mode === 'create') {
        // CREATE: jumlahTerbayar=0, status=Belum Bayar, histori=null + stok log
        const updates = {};
        updates[`transaksiJualBuku/${txKey}`] = {
          ...baseTx,
          jumlahTerbayar: 0,
          statusPembayaran: 'Belum Bayar',
          historiPembayaran: null,
        };

        // Stok adjustment saat create: kurangi stok & tulis histori
        for (const item of processedItems) {
          const buku = bukuList.find((b) => b.id === item.idBuku);
          const stokSebelum = Number(buku?.stok || 0);
          const perubahan = -Math.abs(Number(item.jumlah || 0));
          const stokSesudah = stokSebelum + perubahan;

          const histRef = ref(db, `buku/${item.idBuku}/historiStok`);
          const logKey = push(histRef).key;

          updates[`buku/${item.idBuku}/stok`] = stokSesudah;
          updates[`buku/${item.idBuku}/historiStok/${logKey}`] = {
            timestamp: serverTimestamp(),
            keterangan: `Penjualan via invoice ${data.nomorInvoice}`,
            perubahan,
            stokSebelum,
            stokSesudah,
          };
        }
        await update(ref(db), updates);
      } else {
        // EDIT: hanya update transaksi; tidak mengubah stok
        const keepPaid = {
          jumlahTerbayar: Number(initialTx.jumlahTerbayar || 0),
          statusPembayaran: initialTx.statusPembayaran || 'Belum Bayar',
          historiPembayaran: initialTx.historiPembayaran || null,
        };
        await update(ref(db, `transaksiJualBuku/${txKey}`), { ...baseTx, ...keepPaid });
      }

      message.success({ content: 'Transaksi berhasil disimpan', key: 'tx' });
      form.resetFields();
      setSelectedPelanggan(null);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      message.error({ content: `Gagal menyimpan: ${error.message}`, key: 'tx' });
    } finally {
      setIsSaving(false);
    }
  };

  // ===== Delete (Edit only) =====
  const handleDelete = async () => {
    if (mode !== 'edit' || !initialTx?.id) return;
    try {
      await remove(ref(db, `transaksiJualBuku/${initialTx.id}`));
      message.success('Transaksi dihapus.');
      onSuccess?.();
    } catch (e) {
      console.error(e);
      message.error('Gagal menghapus transaksi');
    }
  };

  // ===== Subtotal item (read-only) =====
  const SubtotalField = ({ index }) => (
    <Form.Item
      noStyle
      shouldUpdate={(prev, cur) =>
        prev.items?.[index]?.jumlah !== cur.items?.[index]?.jumlah ||
        prev.items?.[index]?.hargaSatuan !== cur.items?.[index]?.hargaSatuan ||
        prev.items?.[index]?.diskonPersen !== cur.items?.[index]?.diskonPersen
      }
    >
      {({ getFieldValue }) => {
        const jumlah = Number(getFieldValue(['items', index, 'jumlah']) || 0);
        const hargaSatuan = Number(getFieldValue(['items', index, 'hargaSatuan']) || 0);
        const diskon = Number(getFieldValue(['items', index, 'diskonPersen']) || 0);
        const subtotal = Math.round(hargaSatuan * jumlah * (1 - diskon / 100));
        return (
          <InputNumber
            value={subtotal}
            readOnly
            disabled
            formatter={rupiahFormatter}
            parser={rupiahParser}
            style={{ width: 180, textAlign: 'right' }}
          />
        );
      }}
    </Form.Item>
  );

  // ===== Header List Item =====
  const ItemsHeader = () => (
    <Row gutter={12} style={{ fontWeight: 600, color: '#555', marginBottom: 8 }}>
      <Col style={{ width: 300 }}>Buku</Col>
      <Col style={{ width: 80 }}>Qty</Col>
      <Col style={{ width: 150 }}>Harga Satuan</Col>
      <Col style={{ width: 100 }}>Diskon %</Col>
      <Col style={{ width: 180, textAlign: 'right' }}>Subtotal</Col>
      <Col style={{ width: 80, textAlign: 'center' }}>Aksi</Col>
    </Row>
  );

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ tanggal: dayjs() }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="nomorInvoice" label="Nomor Invoice" rules={[{ required: true }]}>
            <Input
              disabled
              addonBefore={isGeneratingInvoice ? <Spin size="small" /> : null}
              placeholder={isGeneratingInvoice ? 'Membuat nomor...' : 'Nomor invoice'}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="tanggal" label="Tanggal" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="idPelanggan" label="Pelanggan" rules={[{ required: true }]}>
        <Select
          showSearch
          placeholder="Pilih pelanggan"
          onChange={handlePelangganChange}
          filterOption={(input, option) =>
            (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
          }
          disabled={isGeneratingInvoice && mode === 'create'}
        >
          {pelangganList.map((p) => (
            <Option key={p.id} value={p.id}>
              {p.nama} {p.isSpesial && '(Spesial)'}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="keterangan" label="Keterangan (Opsional)">
        <Input.TextArea rows={2} placeholder="Catatan untuk transaksi ini..." />
      </Form.Item>

      <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>
        Item Buku
      </Typography.Title>

      {/* Header kolom */}
      <ItemsHeader />

      <Form.List name="items">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }, index) => (
              <Row
                key={key}
                gutter={12}
                align="middle"
                style={{ marginBottom: 8, borderBottom: '1px dashed #eee', paddingBottom: 8 }}
              >
                <Col style={{ width: 300 }}>
                  <Form.Item {...restField} name={[name, 'idBuku']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                    <Select
                      showSearch
                      placeholder="Pilih Buku"
                      onChange={(idBuku) => handleBukuChange(index, idBuku)}
                      filterOption={(input, option) =>
                        (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {bukuList.map((b) => (
                        <Option key={b.id} value={b.id}>
                          {b.judul}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col style={{ width: 80 }}>
                  <Form.Item {...restField} name={[name, 'jumlah']} rules={[{ required: true }]} initialValue={1} style={{ marginBottom: 0 }}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col style={{ width: 150 }}>
                  <Form.Item {...restField} name={[name, 'hargaSatuan']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                    <InputNumber
                      placeholder="Harga"
                      min={0}
                      formatter={rupiahFormatter}
                      parser={rupiahParser}
                      style={{ width: '100%', textAlign: 'right' }}
                    />
                  </Form.Item>
                </Col>

                <Col style={{ width: 100 }}>
                  <Form.Item {...restField} name={[name, 'diskonPersen']} initialValue={0} style={{ marginBottom: 0 }}>
                    <InputNumber min={0} max={100} suffix="%" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col style={{ width: 180, textAlign: 'right' }}>
                  <SubtotalField index={index} />
                </Col>

                <Col style={{ width: 80, textAlign: 'center' }}>
                  <Button type="text" danger onClick={() => remove(name)}>
                    Hapus
                  </Button>
                </Col>
              </Row>
            ))}

            <Form.Item>
              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
                disabled={!selectedPelanggan || (isGeneratingInvoice && mode === 'create')}
              >
                Tambah Item Buku
              </Button>
              {!selectedPelanggan && (
                <Text type="warning"> Pilih pelanggan terlebih dahulu untuk menambah item.</Text>
              )}
            </Form.Item>
          </>
        )}
      </Form.List>

      {/* GRAND TOTAL & TOTAL QTY (realtime) */}
      <Form.Item
        noStyle
        shouldUpdate={(prev, cur) => JSON.stringify(prev.items || []) !== JSON.stringify(cur.items || [])}
      >
        {({ getFieldValue }) => {
          const items = getFieldValue('items') || [];
          let total = 0;
          let qty = 0;
          items.forEach((it) => {
            const harga = Number(it?.hargaSatuan || 0);
            const diskon = Number(it?.diskonPersen || 0);
            const jml = Number(it?.jumlah || 0);
            total += harga * jml * (1 - diskon / 100);
            qty += jml;
          });

          return (
            <>
              <Divider />
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card bordered={false} style={{ backgroundColor: '#fafafa' }}>
                    <Statistic title="Total Qty Buku" value={qty} />
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card bordered={false} style={{ backgroundColor: '#fafafa' }}>
                    <Statistic
                      title="Grand Total"
                      value={total}
                      formatter={rupiahFormatter}
                    />
                  </Card>
                </Col>
              </Row>
              <Divider />
            </>
          );
        }}
      </Form.Item>

      <Row justify="space-between" style={{ marginTop: 8 }}>
        <Col>
          {mode === 'edit' && (
            <Popconfirm
              title="Hapus transaksi ini?"
              okText="Hapus"
              okButtonProps={{ danger: true }}
              onConfirm={handleDelete}
            >
              <Button danger icon={<DeleteOutlined />}>
                Hapus Transaksi
              </Button>
            </Popconfirm>
          )}
        </Col>
        <Col>
          <Button
            type="primary"
            htmlType="submit"
            loading={isSaving}
            size="large"
            disabled={isGeneratingInvoice && mode === 'create'}
          >
            {mode === 'create' ? 'Simpan Transaksi' : 'Simpan Perubahan'}
          </Button>
        </Col>
      </Row>
    </Form>
  );
}
