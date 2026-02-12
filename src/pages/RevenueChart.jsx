import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import storage from '../storage';
import { formatDate } from '../dateUtils';

function RevenueChart() {
  const [filter, setFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    generateChartData(filter);
  }, [filter, customFrom, customTo]);

  const getDateRange = (filterType) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let startDate = new Date(today);
    let endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    switch (filterType) {
      case 'today':
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'thisweek':
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastweek':
        const lastWeekStart = new Date(startDate);
        lastWeekStart.setDate(startDate.getDate() - startDate.getDay() - 7);
        startDate = lastWeekStart;
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thismonth':
        startDate.setDate(1);
        break;
      case 'lastmonth':
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setDate(1);
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisyear':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      case 'lastyear':
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setMonth(0);
        startDate.setDate(1);
        endDate.setFullYear(endDate.getFullYear() - 1);
        endDate.setMonth(11);
        endDate.setDate(31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customFrom && customTo) {
          startDate = new Date(`${customFrom}T00:00:00`);
          endDate = new Date(`${customTo}T23:59:59`);
        }
        break;
      default:
        break;
    }

    return { startDate, endDate };
  };

  const generateChartData = (filterType) => {
    const bills = storage.getAllBills();
    const { startDate, endDate } = getDateRange(filterType);

    const filteredBills = bills.filter(bill => {
      const billDate = new Date(bill.created_at);
      return billDate >= startDate && billDate <= endDate;
    });

    // Group by date
    const dataMap = {};
    filteredBills.forEach(bill => {
      const dateKey = formatDate(bill.created_at);
      if (!dataMap[dateKey]) {
        dataMap[dateKey] = { date: dateKey, revenue: 0, bills: 0 };
      }
      dataMap[dateKey].revenue += bill.total;
      dataMap[dateKey].bills += 1;
    });

    const data = Object.values(dataMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    setChartData(data.length > 0 ? data : []);
  };

  return (
    <div className="revenue-chart-container">
      <div className="chart-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <Link to="/" className="btn btn-secondary" style={{ width: 'auto' }}>
            ← Back
          </Link>
          <h2>Revenue Analytics</h2>
        </div>
        <div className="filter-controls">
          <div className="filter-buttons">
            {[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'thisweek', label: 'This Week' },
              { value: 'lastweek', label: 'Last Week' },
              { value: 'thismonth', label: 'This Month' },
              { value: 'lastmonth', label: 'Last Month' },
              { value: 'thisyear', label: 'This Year' },
              { value: 'lastyear', label: 'Last Year' },
              { value: 'custom', label: 'Custom' }
            ].map(option => (
              <button
                key={option.value}
                className={`filter-btn ${filter === option.value ? 'active' : ''}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {filter === 'custom' && (
            <div className="custom-date-range">
              <div className="date-field">
                <label>From</label>
                <div className="date-input">
                  <span className="calendar-icon">📅</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
              </div>
              <div className="date-field">
                <label>To</label>
                <div className="date-input">
                  <span className="calendar-icon">📅</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chart-container">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                style={{ fontSize: '0.9rem' }}
              />
              <YAxis 
                label={{ value: 'Revenue (₹)', angle: -90, position: 'insideLeft' }}
                stroke="#666"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  padding: '0.75rem'
                }}
                formatter={(value) => `₹${value.toFixed(2)}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={{ fill: '#4f46e5', r: 5 }}
                activeDot={{ r: 7 }}
                name="Revenue (₹)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-chart">
            <p>No data available for selected period</p>
          </div>
        )}
      </div>

      <div className="chart-stats no-print">
        {chartData.length > 0 && (
          <>
            <div className="stat">
              <span>Total Revenue</span>
              <strong>₹{chartData.reduce((sum, d) => sum + d.revenue, 0).toFixed(2)}</strong>
            </div>
            <div className="stat">
              <span>Total Bills</span>
              <strong>{chartData.reduce((sum, d) => sum + d.bills, 0)}</strong>
            </div>
            <div className="stat">
              <span>Average per Bill</span>
              <strong>₹{(chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.reduce((sum, d) => sum + d.bills, 0)).toFixed(2)}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RevenueChart;
