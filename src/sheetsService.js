const SHEETS_WEB_APP_URL = import.meta.env.VITE_SHEETS_WEB_APP_URL;

const ensureUrl = () => {
  if (!SHEETS_WEB_APP_URL) {
    throw new Error('Missing VITE_SHEETS_WEB_APP_URL');
  }
};

const parseNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const fallbackId = (prefix) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
};

export const fetchSheetsData = async () => {
  ensureUrl();
  const response = await fetch(SHEETS_WEB_APP_URL, { method: 'GET' });
  if (!response.ok) {
    throw new Error('Failed to fetch sheet data');
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Sheet request failed');
  }
  return data;
};

export const mapSheetProducts = (rows) => {
  if (!Array.isArray(rows)) return [];
  
  const mapped = rows.map((row, index) => {
    const originalId = String(row['Id'] || row['ID'] || '').trim();
    const id = originalId || fallbackId('prod');
    const name = String(row['Name'] || '').trim();
    const code = String(row['Code'] || '').trim();
    const price = parseNumber(row['Price']);
    const stock = parseNumber(row['Available Qty'] ?? row['Quantity']);
    const now = new Date().toISOString();
    
    return {
      id,
      name,
      code,
      price,
      stock,
      created_at: now,
      updated_at: now,
      _hasBlankId: !originalId && name !== ''
    };
  }).filter((product) => product.name);
  
  return mapped;
};

export const mapSheetBills = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const id = String(row['Id'] || row['ID'] || '').trim() || fallbackId('bill');
    const billNumber = String(row['Bill Number'] || row['Bill No'] || '').trim();
    const createdAt = row['Date'] ? new Date(row['Date']).toISOString() : new Date().toISOString();
    const subtotal = parseNumber(row['Sub total']);
    const discount = parseNumber(row['Discount']);
    const total = parseNumber(row['Total Tendered']);

    return {
      id,
      bill_number: billNumber || id,
      customer_name: String(row['Customer Name'] || '').trim(),
      customer_phone: String(row['Phone'] || '').trim(),
      items: [],
      subtotal,
      discount,
      discount_amount: discount,
      tax: 0,
      tax_amount: 0,
      total,
      created_at: createdAt
    };
  }).filter((bill) => bill.bill_number);
};

const postPayload = async (payload) => {
  ensureUrl();
  const response = await fetch(SHEETS_WEB_APP_URL, {
    method: 'POST',
    // Use text/plain to avoid CORS preflight on Apps Script
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error('Failed to write to sheet');
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Sheet write failed');
  }
  return data;
};

const postRows = async (type, rows) => postPayload({ type, rows });

export const appendProductToSheet = async (product) => {
  const row = {
    'Id': product.id,
    'Code': product.code || '',
    'Name': product.name,
    'Price': product.price,
    'Unit(kg,cm,litter)': product.unit || '',
    'Quantity': product.stock,
    'Available Qty': product.stock
  };
  console.log('Sending product to sheet:', row);
  return postRows('products', [row]);
};

export const appendProductsToSheet = async (products) => {
  if (!Array.isArray(products) || products.length === 0) return { ok: true, appended: 0 };
  const rows = products.map((product) => ({
    'Id': product.id,
    'Code': product.code || '',
    'Name': product.name,
    'Price': product.price,
    'Unit(kg,cm,litter)': product.unit || '',
    'Quantity': product.stock,
    'Available Qty': product.stock
  }));
  console.log('Sending products to sheet:', rows);
  return postRows('products', rows);
};

export const upsertProductToSheet = async (product) => {
  const row = {
    'Id': product.id,
    'Code': product.code || '',
    'Name': product.name,
    'Price': product.price,
    'Unit(kg,cm,litter)': product.unit || '',
    'Quantity': product.stock,
    'Available Qty': product.stock
  };
  console.log('Upserting product to sheet:', row);
  return postPayload({ type: 'products', action: 'upsert', rows: [row] });
};

export const deleteProductFromSheet = async (productId) => {
  return postPayload({ type: 'products', action: 'delete', ids: [productId] });
};

export const appendBillToSheet = async (bill) => {
  const row = {
    'Id': bill.id,
    'Bill Number': bill.bill_number,
    'Date': bill.created_at,
    'Customer Name': bill.customer_name || '',
    'Phone': bill.customer_phone || '',
    'Item Id': bill.item_ids || '',
    'Sub total': bill.subtotal,
    'Discount': bill.discount,
    'Total Tendered': bill.total
  };
  return postRows('bills', [row]);
};

export const appendBillsToSheet = async (bills) => {
  if (!Array.isArray(bills) || bills.length === 0) return { ok: true, appended: 0 };
  const rows = bills.map((bill) => ({
    'Id': bill.id,
    'Bill Number': bill.bill_number,
    'Date': bill.created_at,
    'Customer Name': bill.customer_name || '',
    'Phone': bill.customer_phone || '',
    'Item Id': bill.item_ids || '',
    'Sub total': bill.subtotal,
    'Discount': bill.discount,
    'Total Tendered': bill.total
  }));
  return postRows('bills', rows);
};
