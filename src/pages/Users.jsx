import { useState, useEffect } from 'react';
import { formatDateTime } from '../dateUtils';
import './Users.css';

const VITE_SHEETS_WEB_APP_URL = import.meta.env.VITE_SHEETS_WEB_APP_URL;

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'StoreUser',
    shopName: '',
    email: '',
    phone: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(VITE_SHEETS_WEB_APP_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: 'users', action: 'getUsers' })
      });

      const text = await response.text();
      const data = JSON.parse(text);

      if (data.ok && data.users) {
        setUsers(data.users);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Error fetching users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    // Validate form
    if (!formData.username || !formData.password || !formData.fullName) {
      setError('Username, password, and full name are required');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(VITE_SHEETS_WEB_APP_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          type: 'users',
          action: 'createUser',
          user: {
            Username: formData.username,
            Password: formData.password,
            'Full Name': formData.fullName,
            Role: formData.role,
            'Shop Name': formData.shopName,
            Email: formData.email,
            Phone: formData.phone,
            Status: 'active'
          }
        })
      });

      const text = await response.text();
      const data = JSON.parse(text);

      if (data.ok) {
        setSuccessMessage('User created successfully!');
        setFormData({
          username: '',
          password: '',
          fullName: '',
          role: 'StoreUser',
          shopName: '',
          email: '',
          phone: ''
        });
        // Refresh users list
        setTimeout(() => fetchUsers(), 500);
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      setError('Error creating user: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const response = await fetch(VITE_SHEETS_WEB_APP_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          type: 'users',
          action: 'deleteUser',
          userId: userId
        })
      });

      const text = await response.text();
      const data = JSON.parse(text);

      if (data.ok) {
        setSuccessMessage('User deleted successfully!');
        setTimeout(() => fetchUsers(), 500);
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Error deleting user: ' + err.message);
    }
  };

  return (
    <div className="users-container">
      <h2>Manage Users</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      <div className="users-content">
        {/* Create User Form */}
        <div className="create-user-form">
          <h3>Create New User</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select name="role" value={formData.role} onChange={handleInputChange}>
                  <option value="StoreUser">Store User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Shop Name</label>
                <input
                  type="text"
                  name="shopName"
                  value={formData.shopName}
                  onChange={handleInputChange}
                  placeholder="Enter shop name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="users-list">
          <h3>Existing Users</h3>
          {loading ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <p>No users found</p>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.Id}>
                    <td>{user.Username}</td>
                    <td>{user['Full Name']}</td>
                    <td>
                      <span className={`badge badge-${user.Role.toLowerCase()}`}>
                        {user.Role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${user.Status === 'active' ? 'success' : 'warning'}`}>
                        {user.Status}
                      </span>
                    </td>
                    <td>{user.Email}</td>
                    <td>
                      <button
                        onClick={() => handleDeleteUser(user.Id)}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
