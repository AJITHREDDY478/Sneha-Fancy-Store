// Date formatting utility
export const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatDateTime = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const time = d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return `${day}-${month}-${year} ${time}`;
};
