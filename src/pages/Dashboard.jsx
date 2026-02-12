import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import storage from '../storage';

function Dashboard() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayBills: 0,
    totalRevenue: 0,
    totalProducts: 0,
    lowStock: 0
  });

  useEffect(() => {
    setStats(storage.getDashboardStats());
  }, []);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Today's Revenue</h3>
          <div className="value">₹{stats.todayRevenue.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <h3>Today's Bills</h3>
          <div className="value">{stats.todayBills}</div>
        </div>
        <Link to="/revenue-chart" style={{ textDecoration: 'none' }}>
          <div className="stat-card stat-card-clickable" title="Click to view analytics">
            <h3>Total Revenue</h3>
            <div className="value">₹{stats.totalRevenue.toFixed(2)}</div>
          </div>
        </Link>
        <div className="stat-card">
          <h3>Total Products</h3>
          <div className="value">{stats.totalProducts}</div>
        </div>
        <div className="stat-card">
          <h3>Low Stock Items</h3>
          <div className="value">{stats.lowStock}</div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
