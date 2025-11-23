// Import memo dan useState
import React, { useState, memo } from 'react';
import { Space, Tooltip, Button } from 'antd';
import { EditOutlined, HistoryOutlined } from '@ant-design/icons';

// Komponen tombol yang punya loading state sendiri
const BukuActionButtons = memo(({ record, onEdit, onRestock }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleRestockClick = () => {
        setIsLoading(true); // Render ulang tombol ini saja
        
        // Jeda sedikit agar spinner muncul, baru buka modal di parent
        setTimeout(() => {
            onRestock(record); 
            setIsLoading(false); // Matikan loading setelah tugas selesai
        }, 50);
    };

    return (
        <Space size="small">
            <Tooltip title="Edit Detail Buku">
                <Button type="link" icon={<EditOutlined />} onClick={() => onEdit(record)} />
            </Tooltip>
            <Tooltip title="Tambah/Kurangi Stok">
                <Button 
                    type="link" 
                    loading={isLoading} // Loading lokal
                    icon={<HistoryOutlined />} 
                    onClick={handleRestockClick} 
                />
            </Tooltip>
        </Space>
    );
});

export default BukuActionButtons;