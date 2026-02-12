import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import storage from '../storage';
import { fetchSheetsData, mapSheetBills, deleteAllBillsFromSheet } from '../sheetsService';
import { formatDate, formatDateTime } from '../dateUtils';

function Bills() {
  const [bills, setBills] = useState([]);
  const [selected, setSelected] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const location = useLocation();

  useEffect(() => {
    loadBills();
    setSelected(null);
  }, [location]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(getFilteredBills().length / rowsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [bills.length, rowsPerPage, currentPage, searchTerm, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFrom, dateTo]);

  const loadBills = () => {
    const allBills = storage.getAllBills();
    const sortedBills = allBills.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setBills(sortedBills);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await fetchSheetsData();
      const mapped = mapSheetBills(data.bills);
      
      const localBills = storage.getAllBills();
      const localBillsByNumber = new Map(localBills.map((bill) => [bill.bill_number, bill]));
      
      const mergedBills = mapped.map((bill) => {
        const localBill = localBillsByNumber.get(bill.bill_number);
        if (!localBill) return bill;
        return {
          ...bill,
          items: localBill.items || bill.items,
          item_ids: localBill.item_ids || bill.item_ids,
          subtotal: localBill.subtotal ?? bill.subtotal,
          discount: localBill.discount ?? bill.discount,
          discount_amount: localBill.discount_amount ?? bill.discount_amount,
          tax: localBill.tax ?? bill.tax,
          tax_amount: localBill.tax_amount ?? bill.tax_amount,
          total: localBill.total ?? bill.total,
          customer_name: localBill.customer_name || bill.customer_name,
          customer_phone: localBill.customer_phone || bill.customer_phone
        };
      });
      
      storage.setAllBills(mergedBills);
      const sortedBills = mergedBills.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setBills(sortedBills);
      console.log('Bills synced successfully');
    } catch (error) {
      console.error('Sync error:', error);
      alert('Could not sync bills from Google Sheets: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete all bills from Google Sheets? This cannot be undone.')) {
      return;
    }
    setClearing(true);
    try {
      await deleteAllBillsFromSheet();
      storage.clearBills();
      setBills([]);
      setSelected(null);
      alert('All bills deleted.');
    } catch (error) {
      console.error('Delete bills error:', error);
      alert('Could not delete bills from Google Sheets: ' + error.message);
    } finally {
      setClearing(false);
    }
  };

  const getFilteredBills = () => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return bills.filter((bill) => {
      const billDate = new Date(bill.created_at);
      const matchesSearch = !normalizedSearch
        || bill.bill_number.toLowerCase().includes(normalizedSearch)
        || (bill.customer_name || '').toLowerCase().includes(normalizedSearch)
        || (bill.customer_phone || '').toLowerCase().includes(normalizedSearch);
      const matchesFrom = !fromDate || billDate >= fromDate;
      const matchesTo = !toDate || billDate <= toDate;
      return matchesSearch && matchesFrom && matchesTo;
    });
  };

  const filteredBills = getFilteredBills();
  const totalPages = Math.max(1, Math.ceil(filteredBills.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filteredBills.length);
  const pagedBills = filteredBills.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (currentPage > 3) pages.push('...');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const printReceipt = () => {
    window.print();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add logo and header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229);
    doc.text('Sneha Fancy Store', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Bills Report', 105, 25, { align: 'center' });
    
    // Prepare table data
    const tableData = filteredBills.map(bill => [
      bill.bill_number,
      bill.customer_name || 'N/A',
      `₹${bill.total.toFixed(2)}`,
      formatDateTime(bill.created_at)
    ]);
    
    // Add table
    autoTable(doc, {
      startY: 32,
      head: [['Bill #', 'Customer', 'Total', 'Date']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fillColor: [79, 70, 229] },
      foot: [[
        'Total Bills: ' + filteredBills.length,
        '',
        '₹' + filteredBills.reduce((sum, b) => sum + b.total, 0).toFixed(2),
        ''
      ]]
    });
    
    // Save PDF
    const filename = `Bills_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const sendToWhatsApp = () => {
    if (!selected || !selected.customer_phone) {
      alert('Customer phone number not available!');
      return;
    }

    const sendImage = async () => {
      try {
        // Capture receipt as image
        const receiptElement = document.querySelector('.receipt');
        const canvas = await html2canvas(receiptElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          allowTaint: true,
          logging: false
        });

        const image = canvas.toDataURL('image/png');

        // Convert data URL to blob
        const response = await fetch(image);
        const blob = await response.blob();

        // Try to share using Web Share API if available
        if (navigator.share) {
          const file = new File([blob], `receipt_${selected.bill_number}.png`, { type: 'image/png' });
          await navigator.share({
            files: [file],
            title: 'Bill Receipt',
            text: `Receipt from Sneha Fancy Store - Bill No: ${selected.bill_number}`
          });
        } else {
          // Fallback: Download and open WhatsApp
          // Download the image
          const link = document.createElement('a');
          link.href = image;
          link.download = `receipt_${selected.bill_number}.png`;
          link.click();

          // Open WhatsApp
          const phoneNumber = selected.customer_phone.replace(/\D/g, '');
          const message = `Receipt Image - Bill No: ${selected.bill_number}`;
          const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
          window.open(whatsappURL, '_blank');

          alert('Receipt image downloaded. Please open WhatsApp and attach the image.');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Error generating receipt image. Please try again.');
      }
    };

    sendImage();
  };

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn btn-secondary"
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
            minWidth: 'auto',
            width: 'auto'
          }}
        >
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
        <button
          onClick={handleClearAll}
          disabled={clearing}
          className="btn btn-danger"
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
            minWidth: 'auto',
            width: 'auto'
          }}
        >
          {clearing ? 'Deleting...' : 'Delete All'}
        </button>
        <h1 className="page-title" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>Bills</h1>
      </div>
      
      {selected ? (
        <div>
          <div className="no-print" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={printReceipt}>
              🖨️ Print
            </button>
          </div>
          
          <div className="receipt">
            <div className="receipt-header">
              <img src={`${import.meta.env.BASE_URL}ss.jpg`} alt="Sneha Fancy Store" className="receipt-logo" />
              <h1>Sneha Fancy Store</h1>
              <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>Opposite to Vaishnavi Hotel, Shahapur, Karnataka 585223</p>
              <p style={{ fontSize: '0.85rem', color: '#666' }}>Phone: 087926 85004</p>
            </div>

            <div className="receipt-info">
              <div>
                <strong>Bill No:</strong> {selected.bill_number}<br/>
                <strong>Date:</strong> {formatDateTime(selected.created_at)}<br/>
                <strong>GST No:</strong> Applied
              </div>
            </div>

            <table className="receipt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{item.name}</td>
                    <td>₹{item.price.toFixed(2)}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="receipt-total">
              {(selected.discount_amount > 0 && selected.subtotal > 0) && (
                <>
                  <div className="total-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Sub total:</span>
                    <span>₹{selected.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="total-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem', color: '#d32f2f' }}>
                    <span>Discount:</span>
                    <span>-₹{selected.discount_amount.toFixed(2)}</span>
                  </div>
                </>
              )}
              {selected.tax > 0 && (
                <div className="total-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem', color: '#388e3c' }}>
                  <span>Tax ({selected.tax}%):</span>
                  <span>+₹{selected.tax_amount ? selected.tax_amount.toFixed(2) : '0.00'}</span>
                </div>
              )}
              <div className="total-row" style={{ justifyContent: 'space-between', borderTop: '1px solid #ccc', paddingTop: '0.5rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                <span>Total Amount:</span>
                <span>₹{selected.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="receipt-footer" style={{ textAlign: 'center' }}>
              <p>Thank you</p>
              <p>Please visit again 🙏</p>
            </div>
          </div>

          <div className="no-print" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={sendToWhatsApp} style={{ width: '100%', maxWidth: '300px' }}>
              💬 Send to WhatsApp
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="no-print" style={{ marginBottom: '0rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={exportToPDF} className="btn btn-primary" style={{ width: 'auto', maxWidth: '300px', marginRight: '1rem' }}>
              📄 Export
            </button>
          </div>

          <div className="bills-toolbar no-print">
            <div className="search-input">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search bill #, customer, phone"
              />
            </div>
            <div className="date-filters">
              <div className="date-field">
                <label>From</label>
                <div className="date-input">
                  <span className="calendar-icon">📅</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
              </div>
              <div className="date-field">
                <label>To</label>
                <div className="date-input">
                  <span className="calendar-icon">📅</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

        <div className="card">
          {filteredBills.length === 0 ? (
            <p>No bills found.</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '15%' }}>Bill #</th>
                    <th style={{ width: '20%' }}>Customer</th>
                    <th style={{ width: '25%' }}>Total</th>
                    <th style={{ width: '25%' }}>Date</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBills.map(bill => (
                    <tr key={bill.id}>
                      <td style={{ width: '15%' }}>{bill.bill_number}</td>
                      <td style={{ width: '20%' }}>{bill.customer_name || 'N/A'}</td>
                      <td style={{ width: '25%' }}>₹{bill.total.toFixed(2)}</td>
                      <td style={{ width: '25%' }}>{formatDateTime(bill.created_at)}</td>
                      <td style={{ width: '15%', textAlign: 'center' }}>
                        <button 
                          className="btn btn-primary btn-icon" 
                          onClick={() => setSelected(bill)} 
                          title="View Details"
                          style={{ 
                            padding: '0.4rem 0.5rem',
                            fontSize: '0.9rem',
                            minWidth: '36px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination-bar no-print">
                <div className="rows-control">
                  <span>per page</span>
                  <select
                    className="rows-select"
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setCurrentPage(1);
                    }}
                  >
                    {[10, 50, 100, 500].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                <div className="range-text">
                  {filteredBills.length === 0 ? '0-0' : `${startIndex + 1}-${endIndex}`} of {filteredBills.length}
                </div>

                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    &lt;
                  </button>
                  {getPageNumbers().map((page, idx) => (
                    page === '...'
                      ? <span key={`ellipsis-${idx}`} className="page-ellipsis">...</span>
                      : (
                        <button
                          key={page}
                          className={`page-btn ${currentPage === page ? 'active' : ''}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      )
                  ))}
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      )}
    </div>
  );
}

export default Bills;
