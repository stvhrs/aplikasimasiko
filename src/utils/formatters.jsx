// Helper Functions (Global)
export const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

export const numberFormatter = (value) => {
    // Pengaman jika value null/undefined
    const num = Number(value);
    if (isNaN(num)) {
        return new Intl.NumberFormat('id-ID').format(0);
    }
    return new Intl.NumberFormat('id-ID').format(num);
};
    
export const percentFormatter = (value) => `${value || 0}%`;

export const generateFilters = (data, key) => {
    if (!data || data.length === 0) return [];
    const uniqueValues = [...new Set(data.map(item => item[key]).filter(Boolean))];
    uniqueValues.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    return uniqueValues.map(value => ({ text: String(value), value: value }));
};

export const timestampFormatter = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('id-ID', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
};