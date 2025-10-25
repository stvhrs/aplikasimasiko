// ================================
// FILE: src/components/KeepAliveRouter.jsx
// ================================
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Komponen container yang merender semua children (halaman)
 * tetapi hanya menampilkan yang sesuai dengan path saat ini.
 * Ini mencegah unmount komponen saat navigasi.
 */
export default function KeepAliveRouter({ children }) {
  const location = useLocation();
  const [renderedPaths, setRenderedPaths] = useState({});

  useEffect(() => {
    // Tambahkan path saat ini ke daftar path yang sudah pernah dirender
    // Setidaknya sekali di-render, components/pages akan tetap mounted
    setRenderedPaths(prev => ({ ...prev, [location.pathname]: true }));
  }, [location.pathname]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Iterate melalui children (semua komponen Page Anda) */}
      {React.Children.map(children, child => {
        // Cek apakah child ini adalah elemen React yang valid dan memiliki prop path
        if (!React.isValidElement(child) || !child.props.path) {
          return null;
        }

        const path = child.props.path;
        
        // Halaman hanya di-render jika sudah pernah diakses/dirender
        const shouldRender = renderedPaths[path];
        
        // Cek apakah ini halaman yang sedang aktif
        const isCurrent = location.pathname === path;

        // Terapkan gaya CSS untuk menyembunyikan halaman yang tidak aktif
        const style = {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          // Kunci utamanya: gunakan 'hidden' jika tidak aktif
          visibility: isCurrent ? 'visible' : 'hidden',
          // Agar tidak ada interaksi saat tersembunyi
          pointerEvents: isCurrent ? 'auto' : 'none', 
          // Atur Z-index agar halaman aktif selalu di atas
          zIndex: isCurrent ? 1 : 0
        };

        return shouldRender ? (
          <div key={path} style={style}>
            {child}
          </div>
        ) : null;
      })}
    </div>
  );
}