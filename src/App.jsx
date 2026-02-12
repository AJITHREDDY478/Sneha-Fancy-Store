import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import CreateBill from './pages/CreateBill';
import Bills from './pages/Bills';
import RevenueChart from './pages/RevenueChart';
import { formatDateTime } from './dateUtils';
import storage from './storage';
import { fetchSheetsData, mapSheetProducts, mapSheetBills, appendBillsToSheet, appendProductsToSheet } from './sheetsService';
import './App.css';

function AppContent() {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Handle redirect from 404.html
    if (sessionStorage.redirect) {
      const redirect = sessionStorage.redirect;
      delete sessionStorage.redirect;
      navigate(redirect);
    }
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const syncFromSheet = async () => {
    setGlobalSyncing(true);
    try {
      const data = await fetchSheetsData();
      const mappedProducts = mapSheetProducts(data.products);
      const mappedBills = mapSheetBills(data.bills);
      const localProducts = storage.getAllProducts();
      const localBills = storage.getAllBills();
      
      // Merge products with local data to preserve timestamps
      const localProductsById = new Map(localProducts.map((p) => [p.id, p]));
      const mergedProducts = mappedProducts.map((sheetProduct) => {
        const localProduct = localProductsById.get(sheetProduct.id);
        if (!localProduct) return sheetProduct;
        return {
          ...sheetProduct,
          created_at: localProduct.created_at,
          updated_at: localProduct.updated_at
        };
      });
      
      // Merge bills with local data to preserve items
      const localBillsByNumber = new Map(localBills.map((bill) => [bill.bill_number, bill]));
      const mergedBills = mappedBills.map((bill) => {
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
      
      if (mergedProducts.length > 0) {
        console.log('Background sync: merged products from sheet', mergedProducts.length);
        storage.setAllProducts(mergedProducts);
      } else if (localProducts.length > 0) {
        appendProductsToSheet(localProducts).catch((error) => {
          console.warn('Background product seed failed.', error);
        });
      }
      if (mergedBills.length > 0) {
        storage.setAllBills(mergedBills);
      } else if (localBills.length > 0) {
        appendBillsToSheet(localBills).catch((error) => {
          console.warn('Background bill seed failed.', error);
        });
      }

      const sheetBillNumbers = new Set(mappedBills.map((bill) => bill.bill_number).filter(Boolean));
      const missingBills = localBills.filter((bill) => bill.bill_number && !sheetBillNumbers.has(bill.bill_number));
      if (missingBills.length > 0) {
        appendBillsToSheet(missingBills).catch((error) => {
          console.warn('Background bill push failed.', error);
        });
      }
    } catch (error) {
      console.error('Background sheet sync failed:', error);
    } finally {
      setGlobalSyncing(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      syncFromSheet();
    }, 0);
  }, []);
  return (
    <div className="app">
      <nav className="navbar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1 style={{ margin: 0 }}>
            <img src={`${import.meta.env.BASE_URL}store.png`} alt="Logo" className="nav-logo" />
            Store
          </h1>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {formatDateTime(currentDateTime)}
          </div>
        </div>
        <div className="nav-links">
          <Link to="/">Dashboard</Link>
          <Link to="/products">Products</Link>
          <Link to="/create-bill">New Bill</Link>
          <Link to="/bills">Bills</Link>
        </div>
      </nav>

      {globalSyncing && (
        <div className="sync-banner" role="status" aria-live="polite">
          Syncing data from Google Sheets...
        </div>
      )}
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/create-bill" element={<CreateBill />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/revenue-chart" element={<RevenueChart />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <AppContent />
    </Router>
  );
}

export default App;
