// localStorage wrapper for billing app
class StorageService {
  constructor() {
    this.PRODUCTS_KEY = 'billing_products';
    this.BILLS_KEY = 'billing_bills';
  }

  // Products
  getAllProducts() {
    const data = localStorage.getItem(this.PRODUCTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  setAllProducts(products) {
    localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(products));
  }

  addProduct(product) {
    const products = this.getAllProducts();
    products.push(product);
    localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(products));
  }

  updateProduct(id, updates) {
    let products = this.getAllProducts();
    products = products.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p);
    localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(products));
  }

  deleteProduct(id) {
    let products = this.getAllProducts();
    products = products.filter(p => p.id !== id);
    localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(products));
  }

  // Bills
  getAllBills() {
    const data = localStorage.getItem(this.BILLS_KEY);
    return data ? JSON.parse(data) : [];
  }

  setAllBills(bills) {
    localStorage.setItem(this.BILLS_KEY, JSON.stringify(bills));
  }

  addBill(bill) {
    const bills = this.getAllBills();
    bills.push(bill);
    localStorage.setItem(this.BILLS_KEY, JSON.stringify(bills));
  }

  // Stats
  getDashboardStats() {
    const bills = this.getAllBills();
    const products = this.getAllProducts();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayBills = bills.filter(b => {
      const billDate = new Date(b.created_at);
      billDate.setHours(0, 0, 0, 0);
      return billDate.getTime() === today.getTime();
    });
    
    return {
      todayRevenue: todayBills.reduce((sum, b) => sum + b.total, 0),
      todayBills: todayBills.length,
      totalRevenue: bills.reduce((sum, b) => sum + b.total, 0),
      totalProducts: products.length,
      lowStock: products.filter(p => p.stock < 10).length
    };
  }
}

export default new StorageService();
