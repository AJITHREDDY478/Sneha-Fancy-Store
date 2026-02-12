import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import storage from '../storage';
import { fetchSheetsData, mapSheetProducts, appendProductToSheet, upsertProductToSheet, deleteProductFromSheet } from '../sheetsService';

function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', price: '', stock: '' });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    setProducts(storage.getAllProducts());
    setSelectedProducts(new Set());
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await fetchSheetsData();
      const mapped = mapSheetProducts(data.products);
      
      const localProducts = storage.getAllProducts();
      const localById = new Map(localProducts.map(p => [p.id, p]));
      
      // Merge: preserve local items array for bills
      const mergedProducts = mapped.map(sheetProduct => {
        const local = localById.get(sheetProduct.id);
        if (!local) return sheetProduct;
        return {
          ...sheetProduct,
          created_at: local.created_at || sheetProduct.created_at,
          updated_at: local.updated_at || sheetProduct.updated_at
        };
      });
      
      storage.setAllProducts(mergedProducts);
      setProducts(mergedProducts);
      console.log('Products synced:', mergedProducts.length);
    } catch (error) {
      console.error('Sync error:', error);
      alert('Could not sync products from Google Sheets: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (editing) {
        const updatedProduct = {
          ...storage.getAllProducts().find(p => p.id === editing),
          name: form.name,
          code: form.code,
          price: parseFloat(form.price),
          stock: parseInt(form.stock),
          updated_at: new Date().toISOString()
        };
        
        await upsertProductToSheet(updatedProduct);
        storage.updateProduct(editing, {
          name: form.name,
          code: form.code,
          price: parseFloat(form.price),
          stock: parseInt(form.stock)
        });
        
        setEditing(null);
      } else {
        const newProduct = {
          id: uuidv4(),
          name: form.name,
          code: form.code || '',
          price: parseFloat(form.price),
          stock: parseInt(form.stock),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        await appendProductToSheet(newProduct);
        storage.addProduct(newProduct);
      }
      
      setForm({ name: '', code: '', price: '', stock: '' });
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product) => {
    setForm({ name: product.name, code: product.code || '', price: product.price, stock: product.stock });
    setEditing(product.id);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this product?')) {
      try {
        await deleteProductFromSheet(id);
        storage.deleteProduct(id);
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product. Please try again.');
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const toggleSelectProduct = (id) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedProducts.size === 0) {
      alert('No products selected!');
      return;
    }

    if (!confirm(`Delete ${selectedProducts.size} selected product(s)?`)) {
      return;
    }

    setDeleting(true);
    try {
      for (const id of selectedProducts) {
        await deleteProductFromSheet(id);
        storage.deleteProduct(id);
      }
      loadProducts();
      alert(`${selectedProducts.size} product(s) deleted successfully!`);
    } catch (error) {
      console.error('Error deleting products:', error);
      alert('Error deleting some products. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
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
        <h1 className="page-title" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>Products</h1>
      </div>
      
      <div className="card">
        <h2>{editing ? 'Edit Product' : 'Add Product'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Product Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Product Code</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Unique code for lookup"
              required
            />
          </div>
          <div className="form-group">
            <label>Price (₹)</label>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Stock</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : `${editing ? 'Update' : 'Add'} Product`}
          </button>
          {editing && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setEditing(null); setForm({ name: '', code: '', price: '', stock: '' }); }}
              style={{ marginTop: '0.5rem' }}
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Product List</h2>
          {selectedProducts.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="btn btn-danger"
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                width: 'auto'
              }}
            >
              {deleting ? 'Deleting...' : `Delete Selected (${selectedProducts.size})`}
            </button>
          )}
        </div>
        {products.length === 0 ? (
          <p>No products yet. Add your first product above!</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '5%', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                </th>
                <th style={{ width: '27%' }}>Name</th>
                <th style={{ width: '15%' }}>Code</th>
                <th style={{ width: '18%' }}>Price</th>
                <th style={{ width: '15%' }}>Stock</th>
                <th style={{ width: '20%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td style={{ width: '5%', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => toggleSelectProduct(product.id)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                  </td>
                  <td style={{ width: '27%' }}>{product.name}</td>
                  <td style={{ width: '15%', color: '#666' }}>{product.code || '-'}</td>
                  <td style={{ width: '18%' }}>₹{product.price.toFixed(2)}</td>
                  <td style={{ width: '15%' }}>{product.stock}</td>
                  <td style={{ width: '20%' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleEdit(product)} 
                        title="Edit"
                        style={{ 
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0.20rem',
                          color: 'inherit',
                          lineHeight: '1'
                        }}
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)} 
                        title="Delete"
                        style={{ 
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0.20rem',
                          color: 'inherit',
                          lineHeight: '1'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Products;
