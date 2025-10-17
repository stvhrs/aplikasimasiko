 
import React from 'react';
import { Space, Tag } from 'antd';

const chipStyle = { border: '1px solid #d9d9d9', padding: '4px 10px', borderRadius: '16px' };

const KategoriChips = ({ kategoriMap, onSelect, selectedKategori }) => (
  <Space wrap>
    {Object.entries(kategoriMap).map(([key, value]) => (
      <Tag.CheckableTag
        key={key}
        checked={selectedKategori.includes(key)}
        onChange={() => onSelect('selectedKategori', key)}
        style={chipStyle}
      >
        {value}
      </Tag.CheckableTag>
    ))}
  </Space>
);

export default KategoriChips;