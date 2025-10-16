import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, InputNumber, DatePicker, Radio, Select, Upload, Button
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../constants';

// ====================== COMPONENTS ======================
const TransaksiForm = ({ open, onCancel, onFinish, initialValues, loading }) => {
  const [form] = Form.useForm();
  const [tipe, setTipe] = useState(initialValues?.tipe || TipeTransaksi.pemasukan);
  const [fileList, setFileList] = useState([]);

  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue({
        ...initialValues,
        tanggal: initialValues.tanggal ? dayjs(initialValues.tanggal) : dayjs(),
        jumlah: Math.abs(initialValues.jumlah || 0)
      });
      setTipe(initialValues.tipe || TipeTransaksi.pemasukan);
      if (initialValues.buktiUrl) {
        setFileList([{ uid: '-1', name: 'File terlampir', status: 'done', url: initialValues.buktiUrl, thumbUrl: initialValues.buktiUrl }]);
      } else {
        setFileList([]);
      }
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({ tipe: TipeTransaksi.pemasukan, tanggal: dayjs(), kategori: 'transaksi_buku' });
      setTipe(TipeTransaksi.pemasukan);
      setFileList([]);
    }
  }, [initialValues, form, open]);

  const handleTipeChange = (e) => {
    const newTipe = e.target.value;
    setTipe(newTipe);
    form.setFieldsValue({
      kategori: newTipe === TipeTransaksi.pemasukan ? 'transaksi_buku' : 'operasional'
    });
  };

  const normFile = (e) => (Array.isArray(e) ? e : e && e.fileList);
  const handleUploadChange = ({ fileList: newFileList }) => setFileList(newFileList);

  return (
    <Modal
      open={open}
      title={initialValues ? 'Edit Transaksi' : 'Tambah Transaksi'}
      okText="Simpan"
      cancelText="Batal"
      onCancel={onCancel}
      onOk={() => {
        form.validateFields().then(onFinish).catch(() => {});
      }}
      destroyOnClose
      confirmLoading={loading}
    >
      <Form form={form} layout="vertical" name="transaksi_form" initialValues={{ tipe: TipeTransaksi.pemasukan, tanggal: dayjs() }}>
        <Form.Item name="tanggal" label="Tanggal Transaksi" rules={[{ required: true, message: 'Tanggal wajib diisi!' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="jumlah" label="Jumlah" rules={[{ required: true, message: 'Jumlah wajib diisi!' }, { type: 'number', min: 1, message: 'Jumlah harus lebih dari 0' }]}>
          <InputNumber prefix="Rp " style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => v.replace(/[^\d]/g, '')} />
        </Form.Item>
        <Form.Item name="keterangan" label="Keterangan" rules={[{ required: true, message: 'Keterangan wajib diisi!' }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="tipe" label="Tipe Transaksi">
          <Radio.Group onChange={handleTipeChange} disabled={!!initialValues}>
            <Radio.Button value={TipeTransaksi.pemasukan}>Pemasukan</Radio.Button>
            <Radio.Button value={TipeTransaksi.pengeluaran}>Pengeluaran</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="kategori" label="Kategori" rules={[{ required: true, message: 'Kategori wajib diisi!' }]}>
          <Select placeholder="Pilih kategori" disabled={!!initialValues}>
            {(tipe === TipeTransaksi.pemasukan ? Object.entries(KategoriPemasukan) : Object.entries(KategoriPengeluaran))
              .map(([key, value]) => (<Select.Option key={key} value={key}>{value}</Select.Option>))}
          </Select>
        </Form.Item>
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
