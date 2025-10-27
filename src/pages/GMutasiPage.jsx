 
import React, { useState } from 'react';
import { Layout, Card, Button, Progress, Row, Col, Typography, message } from 'antd';
import { ref, push } from 'firebase/database';
import { db } from '../api/firebase';
import { KategoriPemasukan, KategoriPengeluaran } from '../constants';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const random = {
  get: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  getKey: (obj) => {
    const keys = Object.keys(obj);
    return keys[Math.floor(Math.random() * keys.length)];
  },
  getDate: () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 365);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
};

const generateDummyData = async (db, onProgress) => {
  const transaksiRef = ref(db, 'mutasi');
  const totalData = 200000;
  const batchSize = 500;
  let dataGenerated = 0;

  for (let i = 0; i < totalData / batchSize; i++) {
    const promises = [];
    for (let j = 0; j < batchSize; j++) {
      const tipe = Math.random() > 0.4 ? 'pemasukan' : 'pengeluaran';
      let kategoriKey, kategoriValue;

      if (tipe === 'pemasukan') {
        kategoriKey = random.getKey(KategoriPemasukan);
        kategoriValue = KategoriPemasukan[kategoriKey];
      } else {
        kategoriKey = random.getKey(KategoriPengeluaran);
        kategoriValue = KategoriPengeluaran[kategoriKey];
      }

      let jumlah = random.get(1000, 2000000);
      if (tipe === 'pengeluaran') jumlah = -Math.abs(jumlah);

      const transaksiData = {
        tanggal: random.getDate().getTime(),
        jumlah,
        keterangan: `${kategoriValue} #${random.get(100, 999)}`,
        tipe,
        kategori: kategoriKey,
        buktiUrl: null,
      };
      promises.push(push(transaksiRef, transaksiData));
    }
    await Promise.all(promises);
    dataGenerated += batchSize;
    onProgress((dataGenerated / totalData) * 100);
  }
};

const GMutasiPage = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    message.loading({ content: 'Memulai proses generator data...', key: 'generator' });

    try {
      await generateDummyData(db, (p) => setProgress(p));
      message.success({ content: `SUKSES! 20000 data berhasil dibuat.`, key: 'generator', duration: 4 });
    } catch (error) {
      console.error("Error generating data:", error);
      message.error({ content: 'Gagal membuat data, lihat konsol untuk detail.', key: 'generator', duration: 4 });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>
      <Title level={3}>Generator Data Dummy</Title>
      <Paragraph type="secondary">Gunakan halaman ini untuk mengisi database Anda dengan data transaksi acak untuk keperluan pengujian dan pengembangan.</Paragraph>
      <Card>
        <Row align="middle" gutter={[16, 16]}>
          <Col>
            <Button type="primary" size="large" onClick={handleGenerate} loading={isGenerating}>
              {isGenerating ? 'Sedang Membuat Data...' : 'Buat 20000 Data Transaksi'}
            </Button>
          </Col>
          <Col flex="auto">
            {isGenerating && <Progress percent={Math.round(progress)} />}
          </Col>
        </Row>
        <Paragraph style={{ marginTop: '16px' }} type="warning">
          <strong>Perhatian:</strong> Proses ini akan menambahkan 20 ribu entri baru ke node <code>transaksi</code> di Firebase Realtime Database Anda. Proses ini tidak dapat dibatalkan.
        </Paragraph>
      </Card>
    </Content>
  );
};

export default GMutasiPage;