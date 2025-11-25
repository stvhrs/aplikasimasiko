import React from 'react';
import { Tag, Space } from 'antd';

const { CheckableTag } = Tag;

const KategoriChips = ({ kategoriMap, selectedKategori, onSelect }) => {
    // Style untuk Chip
    const chipStyle = {
        border: '1px solid #d9d9d9',
        padding: '4px 12px',
        borderRadius: '16px',
        cursor: 'pointer',
        fontSize: '12px',
        marginBottom: '8px',
        userSelect: 'none',
        transition: 'all 0.3s'
    };

    const activeChipStyle = {
        ...chipStyle,
        backgroundColor: '#1890ff',
        color: '#fff',
        borderColor: '#1890ff'
    };

    return (
        <Space size={[8, 8]} wrap>
            {Object.entries(kategoriMap).map(([key, value]) => {
                const isSelected = selectedKategori.includes(value); // Cek berdasarkan VALUE ("Penjualan Buku")
                
                return (
                    <CheckableTag
                        key={key}
                        checked={isSelected}
                        style={isSelected ? activeChipStyle : chipStyle}
                        // PENTING: Kirim 'value' ("Penjualan Buku"), JANGAN 'key' ("penjualan_buku")
                        onChange={() => onSelect('selectedKategori', value)} 
                    >
                        {value}
                    </CheckableTag>
                );
            })}
        </Space>
    );
};

export default KategoriChips;