import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  Grid,
  message,
  Typography,
  Button,
  Space,
  Popconfirm // <-- 1. Impor Popconfirm
} from 'antd';
import { ref, push, set, serverTimestamp, remove } from 'firebase/database';
import { db } from '../../../api/firebase';

const { Option } = Select;
const { Text } = Typography;

const BukuForm = ({ open, onCancel, initialValues }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isEditing = !!initialValues;
  const screens = Grid.useBreakpoint();

  useEffect(() => {
    if (open) {
      if (isEditing) {
        form.setFieldsValue(initialValues);
      } else {
        form.resetFields();
        form.setFieldsValue({
          stok: 0,
          hargaJual: 0,
          diskonJual: 0,
          diskonJualSpesial: 0
        });
      }
    }
  }, [initialValues, isEditing, form, open]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const data = {
        ...values,
        hargaJual: Number(values.hargaJual) || 0,
        harga_zona_2: Number(values.harga_zona_2) || 0,
        harga_zona_3: Number(values.harga_zona_3) || 0,
        harga_zona_4: Number(values.harga_zona_4) || 0,
        harga_zona_5a: Number(values.harga_zona_5a) || 0,
        harga_zona_5b: Number(values.harga_zona_5b) || 0,
        diskonJual: Number(values.diskonJual) || 0,
        diskonJualSpesial: Number(values.diskonJualSpesial) || 0,
        stok: Number(values.stok) || 0,
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        const bukuRef = ref(db, `buku/${initialValues.id}`);
        await set(bukuRef, {
          ...initialValues,
          ...data
        });
        message.success("Buku berhasil diperbarui.");
      } else {
        const bukuListRef = ref(db, 'buku');
        const newBukuRef = push(bukuListRef);

        data.createdAt = serverTimestamp();

        const historyRef = push(ref(db, `buku/${newBukuRef.key}/historiStok`));
        data.historiStok = {
          [historyRef.key]: {
            keterangan: "Stok Awal (Manual)",
            perubahan: data.stok,
            stokSebelum: 0,
            stokSesudah: data.stok,
            timestamp: serverTimestamp()
          }
        };

        await set(newBukuRef, data);
        message.success("Buku baru berhasil ditambahkan.");
      }
      onCancel();
    } catch (error) {
      console.error("Form submit error:", error);
      message.error("Gagal menyimpan data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🗑️ Fungsi hapus ini sudah benar, akan dipanggil oleh Popconfirm
  const handleDelete = async () => {
    if (!initialValues?.id) return;
    setDeleting(true);
    try {
      await remove(ref(db, `buku/${initialValues.id}`));
      message.success(`Buku "${initialValues.judul}" berhasil dihapus.`);
      onCancel();
    } catch (error) {
      console.error("Delete error:", error);
      message.error("Gagal menghapus buku: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const priceInput = (
    <InputNumber
      style={{ width: '100%' }}
      min={0}
      formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      parser={value => value.replace(/Rp\s?|(,*)/g, '')}
    />
  );

  const tipeBukuOptions = [
    "Buku Teks Utama (BTU)",
    "Buku Teks Pendamping (BTP)",
    "LKS (Lembar Kerja Siswa)",
    "Non Teks",
    "Buku Guru (BG)",
    "Umum",
    "SK (Surat Keputusan)",
    "SK HET (Harga Eceran Tertinggi)",
    "Referensi",
    "Pegangan Guru",
    "Tematik",
    "Modul Ajar / Modul Projek",
    "Eksperimen / Praktikum",
    "Panduan Evaluasi / Soal"
  ];

  return (
    <Modal
      title={isEditing ? "Edit Buku" : "Tambah Buku Baru"}
      open={open}
      onCancel={onCancel}
      width={screens.md ? 1000 : '95vw'}
      destroyOnClose
      footer={null} // Kita buat custom footer sendiri
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={16}>
          <Col sm={12} xs={24}>
            <Form.Item name="kode_buku" label="Kode Buku" rules={[{ required: true, message: 'Kode Buku harus diisi' }]}>
              <Input placeholder="Contoh: 11-22-333-4" />
            </Form.Item>
          </Col>
          <Col sm={12} xs={24}>
            <Form.Item name="judul" label="Judul Buku" rules={[{ required: true, message: 'Judul harus diisi' }]}>
              <Input placeholder="Judul lengkap buku" />
            </Form.Item>
          </Col>
          <Col sm={12} xs={24}>
            <Form.Item name="penerbit" label="Penerbit">
              <Input placeholder="Nama penerbit" />
            </Form.Item>
          </Col>
          <Col sm={12} xs={24}>
            <Form.Item name="stok" label="Stok Awal" rules={[{ required: true, message: 'Stok harus diisi' }]}>
              <InputNumber style={{ width: '100%' }} placeholder="Stok awal" readOnly={isEditing} min={0} />
            </Form.Item>
            {isEditing && (
              <Text type="secondary" style={{ fontSize: 12, marginTop: -12, display: 'block' }}>
                Stok hanya bisa diubah melalui menu 'Update Stok'.
              </Text>
            )}
          </Col>
        </Row>

        <Text strong style={{ display: 'block', marginBottom: 8, marginTop: 16 }}>Data Harga</Text>
        <Row gutter={16}>
          <Col sm={8} xs={24}><Form.Item name="hargaJual" label="Harga Jual (Zona 1)">{priceInput}</Form.Item></Col>
          <Col sm={8} xs={24}><Form.Item name="harga_zona_2" label="Harga Zona 2">{priceInput}</Form.Item></Col>
          <Col sm={8} xs={24}><Form.Item name="harga_zona_3" label="Harga Zona 3">{priceInput}</Form.Item></Col>
          <Col sm={8} xs={24}><Form.Item name="harga_zona_4" label="Harga Zona 4">{priceInput}</Form.Item></Col>
          <Col sm={8} xs={24}><Form.Item name="harga_zona_5a" label="Harga Zona 5a">{priceInput}</Form.Item></Col>
          <Col sm={8} xs={24}><Form.Item name="harga_zona_5b" label="Harga Zona 5b">{priceInput}</Form.Item></Col>
        </Row>

        <Text strong style={{ display: 'block', marginBottom: 8, marginTop: 16 }}>Data Diskon</Text>
        <Row gutter={16}>
          <Col sm={8} xs={12}>
            <Form.Item name="diskonJual" label="Diskon Jual (%)">
              <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={v => `${v}%`} parser={v => v.replace('%', '')} />
            </Form.Item>
          </Col>
          <Col sm={8} xs={12}>
            <Form.Item name="diskonJualSpesial" label="Diskon Spesial (%)">
              <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={v => `${v}%`} parser={v => v.replace('%', '')} />
            </Form.Item>
          </Col>
        </Row>

        <Text strong style={{ display: 'block', marginBottom: 8, marginTop: 16 }}>Data Kategori</Text>
        <Row gutter={16}>
          <Col sm={8} xs={12}><Form.Item name="mapel" label="Mata Pelajaran"><Input placeholder="Contoh: Matematika" /></Form.Item></Col>
          <Col sm={8} xs={12}><Form.Item name="kelas" label="Kelas"><Input placeholder="Contoh: 10 atau X" /></Form.Item></Col>
          <Col sm={8} xs={12}><Form.Item name="spek" label="Spek"><Select allowClear><Option value="Buku">Buku</Option><Option value="LKS">LKS</Option></Select></Form.Item></Col>
          <Col sm={8} xs={12}><Form.Item name="peruntukan" label="Peruntukan"><Select allowClear><Option value="Guru">Guru</Option><Option value="Siswa">Siswa</Option><Option value="Umum">Umum</Option></Select></Form.Item></Col>
          <Col sm={8} xs={12}><Form.Item name="spek_kertas" label="Spek Kertas"><Input placeholder="Contoh: HVS 70gr" /></Form.Item></Col>
          <Col sm={8} xs={12}><Form.Item name="tipe_buku" label="Tipe Buku">
            <Select allowClear>
              {tipeBukuOptions.map(tipe => (
                <Option key={tipe} value={tipe}>{tipe}</Option>
              ))}
            </Select>
          </Form.Item></Col>
        </Row>

        {/* FOOTER BUTTONS */}
        <Row justify="space-between" style={{ marginTop: 24 }}>
          <Col>
            {/* <-- 2. Ganti Button dengan Popconfirm --> */}
            {isEditing && (
              <Popconfirm
                title="Yakin ingin menghapus buku ini?"
                description={`Buku "${initialValues?.judul || 'ini'}" akan dihapus permanen.`}
                onConfirm={handleDelete} // Panggil fungsi hapus saat dikonfirmasi
                okText="Ya, Hapus"
                cancelText="Batal"
                okButtonProps={{ loading: deleting }} // Tampilkan loading di tombol OK
                disabled={deleting} // Nonaktifkan tombol trigger saat sedang menghapus
              >
                <Button danger>
                  Hapus Buku
                </Button>
              </Popconfirm>
            )}
            {/* <-- Akhir Perubahan --> */}
          </Col>
          <Col>
            <Space>
              <Button onClick={onCancel} disabled={loading || deleting}>Batal</Button>
              <Button type="primary" loading={loading} onClick={() => form.submit()} disabled={loading || deleting}>
                {isEditing ? 'Perbarui' : 'Simpan'}
              </Button>
            </Space>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default BukuForm;