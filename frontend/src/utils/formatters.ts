const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);

export const formatDate = (value: string | Date, options?: Intl.DateTimeFormatOptions) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', options ?? {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
};

export const formatTime = (value: string | Date) => formatDate(value, {
  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
});
