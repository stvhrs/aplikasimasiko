import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Switch, Space, message } from 'antd';
import { ref, set, update } from 'firebase/database';
import { db } from '../../../api/firebase';

// ---------- Utils ----------
const slugify = (str) => {
  return String(str || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')    // remove diacritics
    .replace(/[^a-zA-Z0-9]+/g, '-')     // non-alnum -> dash
    .replace(/^-+|-+$/g, '')            // trim dashes
    .toLowerCase()
    .slice(0, 24);                      // batasi agar key tidak kepanjangan
};

const rand4hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4,'0');

const yyyymmdd = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;

const generatePelangganId = (nama) => {
  const date = yyyymmdd();
  const slug = slugify(nama) || 'anon';
  return `PLG-${date}-${slug}-${rand4hex()}`;
};

const trimAll = (v) => (typeof v === 'string' ? v.trim() : v);

// ---------- Component ----------
const PelangganForm = ({ open, onCancel, initialValues }) => {
  const [form] = Form.useForm();
  const isEditing = !!initialValues?.id;
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (isEditing) {
        form.setFieldsValue({
          nama: initialValues.nama ?? '',
          telepon: initialValues.telepon ?? '',
          isSpesial: !!initialValues.isSpesial,
        });
      } else {
        form.setFieldsValue({
          nama: '',
          telepon: '',
          isSpesial: false,
        });
      }
    }
  }, [open, isEditing, initialValues, form]);

  const onFinish = async (values) => {
    const cleanNama = trimAll(values.nama);
    const cleanTelepon = trimAll(values.telepon);

    const payload = {
      nama: cleanNama,
      telepon: cleanTelepon,
      isSpesial: !!values.isSpesial,
      slugNama: slugify(cleanNama),
      updatedAt: Date.now(),
    };

    try {
      setSubmitting(true);

      if (isEditing) {
        // UPDATE ke /pelanggan/{id} — NAMA BOLEH DIUBAH
        const pelangganRef = ref(db, `pelanggan/${initialValues.id}`);
        await update(pelangganRef, payload);
        message.success(`Data ${cleanNama} berhasil diubah.`);
      } else {
        // CREATE dengan ID custom yang rapi
        const newId = generatePelangganId(cleanNama);
        const createdPayload = {
          ...payload,
          id: newId,
          createdAt: Date.now(),
        };
        const pelangganRef = ref(db, `pelanggan/${newId}`);
        await set(pelangganRef, createdPayload);
        message.success(`Pelanggan ${cleanNama} berhasil ditambahkan.`);
      }

      onCancel?.();
    } catch (error) {
      console.error('Gagal menyimpan data:', error);
      message.error('Gagal menyimpan data pelanggan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isEditing ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ isSpesial: false }}
      >
        <Form.Item
          name="nama"
          label="Nama Pelanggan"
          rules={[
            { required: true, message: 'Nama wajib diisi' },
           
            {
              validator: (_, value) => {
                const v = trimAll(value);
                if (!v) return Promise.reject('Nama wajib diisi');
                if (v.length < 3) return Promise.reject('Nama minimal 3 karakter.');
                return Promise.resolve();
              },
            },
          ]}
          normalize={trimAll}
        >
          <Input placeholder="Nama pelanggan/instansi" allowClear />
        </Form.Item>

        <Form.Item
          name="telepon"
          label="No. Telepon"
          rules={[
            { required: true, message: 'Nomor telepon tidak boleh kosong!' },
            {
              validator: (_, value) => {
                const v = trimAll(value);
                if (!v) return Promise.reject('Nomor telepon tidak boleh kosong!');
                if (!/^\+?\d{8,20}$/.test(v)) {
                  return Promise.reject('Nomor telepon harus digit (boleh diawali +).');
                }
                return Promise.resolve();
              },
            },
          ]}
          normalize={trimAll}
        >
          <Input placeholder="0812xxxxxxx" allowClear />
        </Form.Item>

        <Form.Item
          name="isSpesial"
          label="Status Pelanggan Spesial"
          valuePropName="checked"
        >
          <Switch checkedChildren="Spesial" unCheckedChildren="Biasa" />
        </Form.Item>

        <Space style={{ marginTop: 24, width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} disabled={submitting}>Batal</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {isEditing ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
          </Button>
        </Space>
      </Form>
    </Modal>
  );
};

export default PelangganForm;
