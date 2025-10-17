import React from 'react';
import { Space, Tooltip, Button } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const AksiKolom = ({ record, onView, onEdit, onDelete }) => {
    return (
        <Space size="middle">
            <Tooltip title={record.bukti?.url ? "Lihat Bukti" : "Tidak ada bukti"}>
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => onView(record.bukti?.url)}
                    disabled={!record.bukti?.url}
                />
            </Tooltip>
            <Tooltip title="Edit Transaksi">
                <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => onEdit(record)}
                />
            </Tooltip>
            <Tooltip title="Hapus Transaksi">
                <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(record.id)}
                />
            </Tooltip>
        </Space>
    );
};

export default AksiKolom;
