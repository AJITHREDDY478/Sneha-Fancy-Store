import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import CreateBill from './pages/CreateBill';
import Bills from './pages/Bills';
import RevenueChart from './pages/RevenueChart';
import Login from './pages/Login';
import { formatDateTime } from './dateUtils';
import storage from './storage';
import { fetchSheetsData, mapSheetProducts, mapSheetBills, appendBillsToSheet, appendProductsToSheet } from './sheetsService';
import './App.css';

function AppContent() {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing stored user:', err);
        sessionStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

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

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    setUser(null);
  };

  const syncFromSheet = async () => {
    setGlobalSyncing(true);
    try {
      const data = await fetchSheetsData();
      const mappedProducts = mapSheetProducts(data.products);
      const mappedBills = mapSheetBills(data.bills);
      
      // Merge bills to preserve local items array
      const localBills = storage.getAllBills();
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
      
      storage.setAllProducts(mappedProducts);
      storage.setAllBills(mergedBills);
      
      console.log('Synced from Sheets:', mappedProducts.length, 'products,', mergedBills.length, 'bills');
    } catch (error) {
      console.error('Background sheet sync failed:', error);
    } finally {
      setGlobalSyncing(false);
    }
  };

  useEffect(() => {
    if (user) {
      setTimeout(() => {
        syncFromSheet();
      }, 0);
    }
  }, [user]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Show authenticated app
  return (
    <div className="app">
      <nav className="navbar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1 style={{ margin: 0 }}>
            <img src={`${import.meta.env.BASE_URL}ss.jpg`} alt="Sneha Fancy Store logo" className="nav-logo" />
            {user.shopName || 'Sneha Fancy Store'}
          </h1>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {formatDateTime(currentDateTime)}
          </div>
        </div>
        <div className="nav-links" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/">Dashboard</Link>
            <Link to="/products">Products</Link>
            <Link to="/create-bill">New Bill</Link>
            <Link to="/bills">Bills</Link>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: '#666' }}>{user.fullName} ({user.role})</span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: '#d32f2f',
                cursor: 'pointer',
                fontSize: '0.9rem',
                textDecoration: 'underline'
              }}
            >
              Logout
            </button>
          </div>
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
