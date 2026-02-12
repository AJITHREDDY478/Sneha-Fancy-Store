import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import storage from '../storage';
import { appendBillToSheet, upsertProductToSheet } from '../sheetsService';

function CreateBill() {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [manualMode, setManualMode] = useState(false);
  const [manualItem, setManualItem] = useState({ name: '', price: '', quantity: '' });
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);

  useEffect(() => {
    setProducts(storage.getAllProducts());
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectProduct = (product) => {
    setSelectedProduct(product.id);
    setSearchTerm(product.name);
    setShowDropdown(false);
  };

  const addItem = () => {
    if (!selectedProduct) return;
    
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) {
      alert('Please enter a valid quantity!');
      return;
    }
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product || product.stock < qty) {
      alert('Not enough stock!');
      return;
    }

    const existing = items.find(i => i.product_id === selectedProduct);
    if (existing) {
      setItems(items.map(i =>
        i.product_id === selectedProduct
          ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.price }
          : i
      ));
    } else {
      setItems([...items, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        total: product.price * qty
      }]);
    }

    setSelectedProduct('');
    setSearchTerm('');
    setQuantity('');
  };

  const addManualItem = () => {
    const price = parseFloat(manualItem.price) || 0;
    const qty = parseInt(manualItem.quantity) || 0;
    
    if (!manualItem.name || price <= 0 || qty <= 0) {
      alert('Please fill all fields with valid values!');
      return;
    }

    setItems([...items, {
      product_id: uuidv4(),
      name: manualItem.name,
      price: price,
      quantity: qty,
      total: price * qty,
      manual: true
    }]);

    setManualItem({ name: '', price: '', quantity: '' });
  };

  const removeItem = (productId) => {
    setItems(items.filter(i => i.product_id !== productId));
  };

  const getNextBillNumber = (existingBills) => {
    let maxNumber = 0;
    existingBills.forEach((bill) => {
      const match = String(bill.bill_number || '').match(/(\d+)$/);
      if (!match) return;
      const value = parseInt(match[1], 10);
      if (!Number.isNaN(value) && value > maxNumber) {
        maxNumber = value;
      }
    });

    const existingSet = new Set(existingBills.map((bill) => String(bill.bill_number || '').trim()));
    let nextNumber = maxNumber + 1;
    let candidate = `SS${String(nextNumber).padStart(2, '0')}`;
    while (existingSet.has(candidate)) {
      nextNumber += 1;
      candidate = `SS${String(nextNumber).padStart(2, '0')}`;
    }
    return candidate;
  };

  const createBill = async () => {
    if (items.length === 0) {
      alert('Add at least one item!');
      return;
    }

    const existingBills = storage.getAllBills();
    
    const subtotalAmount = items.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = parseFloat(discount) || 0;
    const taxableAmount = subtotalAmount - discountAmount;
    const taxRate = parseFloat(tax) || 0;
    const taxAmount = (taxableAmount * taxRate) / 100;
    const totalAmount = taxableAmount + taxAmount;
    
    // Extract item IDs as comma-separated string
    const itemIds = items.map(item => item.product_id).join(',');
    
    const bill = {
      id: uuidv4(),
      bill_number: getNextBillNumber(existingBills),
      customer_name: customer.name,
      customer_phone: customer.phone,
      items: items,
      item_ids: itemIds,
      subtotal: subtotalAmount,
      discount: discountAmount,
      discount_amount: discountAmount,
      tax: taxRate,
      tax_amount: taxAmount,
      total: totalAmount,
      created_at: new Date().toISOString()
    };

    storage.addBill(bill);

    appendBillToSheet(bill).catch((error) => {
      console.warn('Bill sync failed.', error);
    });

    // Update stock
    items.forEach(item => {
      if (!item.manual) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const newStock = product.stock - item.quantity;
          storage.updateProduct(item.product_id, {
            stock: newStock
          });
          
          const updatedProduct = storage.getAllProducts().find(p => p.id === item.product_id);
          if (updatedProduct) {
            upsertProductToSheet(updatedProduct).catch((error) => {
              console.warn('Stock update sync failed.', error);
            });
          }
        }
      }
    });

    alert('Bill created successfully!');
    setItems([]);
    setCustomer({ name: '', phone: '' });
    setDiscount('');
    setTax('');
    setProducts(storage.getAllProducts());
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discountValue = parseFloat(discount) || 0;
  const taxValue = parseFloat(tax) || 0;
  const taxableAmount = subtotal - discountValue;
  const taxAmount = (taxableAmount * taxValue) / 100;
  const totalAmount = taxableAmount + taxAmount;

  return (
    <div className="create-bill-container">
      <h1 className="page-title">Create New Bill</h1>
      
      <div className="create-bill-layout">
        {/* Left Panel - Form */}
        <div className="create-bill-form">
          {/* Customer Details Section */}
          <div className="form-section">
            <button 
              className="section-toggle-btn"
              onClick={() => setShowCustomerDetails(!showCustomerDetails)}
            >
              <span>{showCustomerDetails ? '▼' : '▶'}</span>
              <span>👤 Customer Details</span>
            </button>
            {showCustomerDetails && (
              <>
                <p className="section-subtitle">Optional - Add customer information</p>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    placeholder="Customer name"
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </>
            )}
          </div>

          {/* Items Section */}
          <div className="form-section">
            <div className="section-header">
              <h2>🛒 Add Products</h2>
            </div>
            
            <div className="mode-toggle">
              <button 
                className={`toggle-btn ${!manualMode ? 'active' : ''}`}
                onClick={() => setManualMode(false)}
              >
                Inventory
              </button>
              <button 
                className={`toggle-btn ${manualMode ? 'active' : ''}`}
                onClick={() => setManualMode(true)}
              >
                Manual Entry
              </button>
            </div>

            {!manualMode ? (
              <div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Search Product</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                      setSelectedProduct('');
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Type product name..."
                  />
                  {showDropdown && filteredProducts.length > 0 && (
                    <div className="product-dropdown">
                      {filteredProducts.map(p => (
                        <div
                          key={p.id}
                          className="product-item"
                          onClick={() => selectProduct(p)}
                        >
                          <div className="product-name">{p.name}</div>
                          <div className="product-info">
                            <span className="price">₹{p.price}</span>
                            <span className="stock">Stock: {p.stock}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="quantity-input-group">
                  <div className="form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                      placeholder="Enter quantity"
                    />
                  </div>
                  <button className="btn btn-primary" onClick={addItem}>
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label>Item Name</label>
                  <input
                    type="text"
                    value={manualItem.name}
                    onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                    placeholder="Enter item name"
                  />
                </div>
                <div className="form-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualItem.price}
                    onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="quantity-input-group">
                  <div className="form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      value={manualItem.quantity}
                      onChange={(e) => setManualItem({ ...manualItem, quantity: e.target.value })}
                      placeholder="Enter quantity"
                      min="1"
                    />
                  </div>
                  <button className="btn btn-primary" onClick={addManualItem}>
                    Add Item
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Bill Summary */}
        <div className="create-bill-summary">
          <div className="bill-summary-box">
            <div className="summary-section">
              <h3>📋 Bill Summary</h3>
              {items.length === 0 ? (
                <div className="empty-state">
                  <p>No items added yet</p>
                  <p style={{ fontSize: '0.85rem', color: '#999' }}>Add products to see the bill summary</p>
                </div>
              ) : (
                <>
                  <div className="items-list">
                    {items.map((item, index) => (
                      <div key={item.product_id} className="summary-item">
                        <div className="item-details">
                          <div className="item-name">{item.name}</div>
                          <div className="item-qty">{item.quantity} × ₹{item.price.toFixed(2)}</div>
                        </div>
                        <div className="item-total">₹{item.total.toFixed(2)}</div>
                        <button 
                          className="btn btn-remove"
                          onClick={() => removeItem(item.product_id)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bill-calculations">
                    <div className="calc-row calc-subtotal">
                      <span>Subtotal:</span>
                      <strong>₹{subtotal.toFixed(2)}</strong>
                    </div>
                    
                    <div className="calc-input-block">
                      <div className="calc-input-row">
                        <span className="calc-label">Discount (₹)</span>
                        <div className="calc-input">
                          <input
                            type="number"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      
                      <div className="calc-input-row">
                        <span className="calc-label">Tax (%)</span>
                        <div className="calc-input">
                          <input
                            type="number"
                            value={tax}
                            onChange={(e) => setTax(e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {(discountValue > 0 || taxValue > 0) && (
                      <div className="calc-result-block">
                        {discountValue > 0 && (
                          <div className="calc-row discount">
                            <span>Discount:</span>
                            <strong>-₹{discountValue.toFixed(2)}</strong>
                          </div>
                        )}
                        {taxValue > 0 && (
                          <div className="calc-row">
                            <span>Tax ({taxValue}%):</span>
                            <strong>+₹{taxAmount.toFixed(2)}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bill-total">
                    <span>Total Amount:</span>
                    <div className="total-amount">₹{totalAmount.toFixed(2)}</div>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    onClick={createBill}
                    style={{ marginTop: '1rem' }}
                  >
                    ✓ Create Bill
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateBill;
