// In-memory cache for Sheets data
class StorageService {
  constructor() {
    this.productsCache = [];
    this.billsCache = [];
    this.isInitialized = false;
  }

  // Products
  getAllProducts() {
    return this.productsCache;
  }

  setAllProducts(products) {
    this.productsCache = products;
  }

  addProduct(product) {
    this.productsCache.push(product);
  }

  updateProduct(id, updates) {
    this.productsCache = this.productsCache.map(p => 
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    );
  }

  deleteProduct(id) {
    this.productsCache = this.productsCache.filter(p => p.id !== id);
  }

  // Bills
  getAllBills() {
    return this.billsCache;
  }

  setAllBills(bills) {
    this.billsCache = bills;
  }

  addBill(bill) {
    // Remove any existing bill with same bill_number, then add
    this.billsCache = this.billsCache.filter((b) => b.bill_number !== bill.bill_number);
    this.billsCache.push(bill);
  }

  clearBills() {
    this.billsCache = [];
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
