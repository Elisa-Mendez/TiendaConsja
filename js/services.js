/**
 * CONSJA Suministros - Servicios Asíncronos REST Simulados (ES6 Modules)
 * CONSJA, S. DE R.L. DE C.V.
 */

// Adaptador de almacenamiento universal (Browser localStorage o fallback en memoria para tests)
const memoryStorage = new Map();
const storage = {
  getItem(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return memoryStorage.get(key) || null;
  },
  setItem(key, value) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStorage.set(key, String(value));
  },
  removeItem(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStorage.delete(key);
  },
  clear() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
    } catch {}
    memoryStorage.clear();
  }
};

const STORAGE_KEYS = {
  CATALOG: 'consja_v3_catalog',
  ORDERS: 'consja_v3_orders'
};

export const INITIAL_PRODUCTS = [
  {
    id: 'prod-mic-10',
    sku: 'MIC-10',
    name: 'Paquete de 10 microfibras',
    image: 'img/Microfibras .png',
    description: 'Paquete con 10 piezas de toallas de microfibra de alta densidad para limpieza profesional de oficinas y comercios.',
    features: [
      '10 piezas de 40 × 40 cm',
      'Color azul institucional',
      'Material microfibra'
    ],
    price: 400,
    stock: 125,
    internalCost: 240, // Confidencial: Solo visible en panel administrativo
    category: 'Limpieza y Mantenimiento',
    unit: 'Paquete c/ 10 pzas',
    badge: 'Más Vendido'
  },
  {
    id: 'prod-dis-01',
    sku: 'DIS-01',
    name: 'Dispensador manual',
    image: 'img/dispensador.png',
    description: 'Dispensador manual de pared para jabón o sanitizante líquido, ideal para áreas de alto tráfico en oficinas y sanitarios.',
    features: [
      'Capacidad volumétrica de 1 litro',
      'Montaje firme en pared (incluye tornillos y taquetes)',
      'Válvula antigoteo de alta resistencia',
      'No incluye líquido o sanitizante'
    ],
    price: 700,
    stock: 35,
    internalCost: 420, // Confidencial: Solo visible en panel administrativo
    category: 'Equipo e Higiene',
    unit: 'Pieza',
    badge: 'Existencia Limitada'
  },
  {
    id: 'prod-kit-01',
    sku: 'KIT-01',
    name: 'Kit de limpieza',
    image: 'img/kit.png',
    description: 'Kit integral para áreas de trabajo que combina paquete de microfibras y dispensador manual para instalación inmediata.',
    features: [
      'Contiene 1 paquete MIC-10 (10 microfibras)',
      'Contiene 1 dispensador manual DIS-01 de 1 L',
      'Se vende como SKU independiente con precio preferente',
      'Presentación lista para uso institucional'
    ],
    price: 1000,
    stock: 0, // Agotado inicialmente
    internalCost: 600, // Confidencial: Solo visible en panel administrativo
    category: 'Kits y Soluciones Integrales',
    unit: 'Kit',
    badge: 'Agotado'
  }
];

const delay = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));

class ProductService {
  constructor() {
    this._ensureStorage();
  }

  _ensureStorage() {
    if (!storage.getItem(STORAGE_KEYS.CATALOG)) {
      storage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(INITIAL_PRODUCTS));
    }
  }

  _getStoredProducts() {
    try {
      const data = storage.getItem(STORAGE_KEYS.CATALOG);
      return data ? JSON.parse(data) : JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    } catch {
      return JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    }
  }

  _saveStoredProducts(products) {
    storage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(products));
  }

  /**
   * Obtiene el catálogo de productos.
   * Regla de negocio: Por defecto los costos internos se eliminan para proteger la confidencialidad.
   */
  async getProducts({ includeInternalCost = false } = {}) {
    await delay(180);
    const products = this._getStoredProducts();
    return products.map(p => {
      const copy = { ...p };
      if (!includeInternalCost) {
        delete copy.internalCost;
      }
      return copy;
    });
  }

  async getProductBySku(sku, { includeInternalCost = false } = {}) {
    await delay(120);
    const products = this._getStoredProducts();
    const product = products.find(p => p.sku.toUpperCase() === sku.toUpperCase());
    if (!product) return null;
    const copy = { ...product };
    if (!includeInternalCost) {
      delete copy.internalCost;
    }
    return copy;
  }

  /**
   * Actualización en caliente de precio y existencias desde el panel de administración
   */
  async updateProductStockPrice(sku, price, stock) {
    await delay(200);
    const products = this._getStoredProducts();
    const index = products.findIndex(p => p.sku.toUpperCase() === sku.toUpperCase());
    if (index === -1) {
      throw new Error(`Producto con SKU ${sku} no encontrado.`);
    }

    const current = products[index];
    const newPrice = Math.max(0, Number(price));
    const newStock = Math.max(0, Math.floor(Number(stock)));

    let badge = current.badge;
    if (newStock === 0) {
      badge = 'Agotado';
    } else if (newStock <= 10) {
      badge = 'Pocas piezas';
    } else if (badge === 'Agotado') {
      badge = undefined;
    }

    products[index] = {
      ...current,
      price: newPrice,
      stock: newStock,
      badge
    };

    this._saveStoredProducts(products);
    return { ...products[index] };
  }

  /**
   * Deduce el inventario de los productos al concretar un pedido
   */
  async deductStock(items) {
    await delay(150);
    const products = this._getStoredProducts();

    // 1. Validar que todos los ítems tengan stock suficiente
    for (const item of items) {
      const prod = products.find(p => p.sku.toUpperCase() === item.sku.toUpperCase());
      if (!prod || prod.stock < item.quantity) {
        throw new Error(`Stock insuficiente para el producto ${item.sku}. Existencia disponible: ${prod ? prod.stock : 0}`);
      }
    }

    // 2. Aplicar descuento
    for (const item of items) {
      const index = products.findIndex(p => p.sku.toUpperCase() === item.sku.toUpperCase());
      if (index !== -1) {
        const newStock = products[index].stock - item.quantity;
        let badge = products[index].badge;
        if (newStock === 0) badge = 'Agotado';
        else if (newStock <= 10) badge = 'Pocas piezas';

        products[index] = {
          ...products[index],
          stock: newStock,
          badge
        };
      }
    }

    this._saveStoredProducts(products);
    return true;
  }

  /**
   * Restablece el catálogo con los valores originales del caso
   */
  async resetCatalog() {
    await delay(150);
    const initial = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this._saveStoredProducts(initial);
    return initial;
  }
}

class OrderService {
  constructor() {
    this._ensureStorage();
  }

  _ensureStorage() {
    if (!storage.getItem(STORAGE_KEYS.ORDERS)) {
      storage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    }
  }

  _getStoredOrders() {
    try {
      const data = storage.getItem(STORAGE_KEYS.ORDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveStoredOrders(orders) {
    storage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }

  _generateFolio() {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `CONSJA-${randomNum}`;
  }

  /**
   * Registra una orden de compra
   */
  async createOrder(orderData, items) {
    await delay(250);
    if (!items || items.length === 0) {
      throw new Error('El carrito está vacío.');
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 0; // Regla comercial: Envío gratuito al comprador ($0.00 MXN)
    const total = subtotal + shipping;
    const folio = this._generateFolio();

    const isTarjeta = orderData.paymentMethod === 'TARJETA';
    const status = isTarjeta ? 'PAGADO' : 'PENDIENTE_PAGO';

    let speiDetails = null;
    if (orderData.paymentMethod === 'SPEI' || orderData.paymentMethod === 'TRANSFERENCIA') {
      speiDetails = {
        bankName: 'BBVA México (Transferencia SPEI)',
        clabe: '012180001948201942',
        accountHolder: 'CONSJA, S. DE R.L. DE C.V.',
        paymentReference: folio,
        amount: total
      };
    }

    const order = {
      id: 'ord-' + Date.now(),
      folio,
      createdAt: new Date().toISOString(),
      customer: { ...orderData.customer },
      items: JSON.parse(JSON.stringify(items)),
      subtotal,
      shipping,
      total,
      paymentMethod: orderData.paymentMethod,
      status,
      estimatedDelivery: '3 a 5 días hábiles después de confirmación de pago (no se garantiza entrega al día siguiente).',
      speiDetails
    };

    const orders = this._getStoredOrders();
    orders.unshift(order);
    this._saveStoredOrders(orders);

    return order;
  }

  async getOrders() {
    await delay(150);
    return this._getStoredOrders();
  }

  async getOrderByFolio(folio) {
    await delay(120);
    const orders = this._getStoredOrders();
    return orders.find(o => o.folio.toUpperCase() === folio.toUpperCase()) || null;
  }

  async updateOrderStatus(folio, status) {
    await delay(180);
    const orders = this._getStoredOrders();
    const index = orders.findIndex(o => o.folio.toUpperCase() === folio.toUpperCase());
    if (index === -1) {
      throw new Error(`Pedido ${folio} no encontrado.`);
    }

    orders[index].status = status;
    this._saveStoredOrders(orders);
    return { ...orders[index] };
  }
}

export const productService = new ProductService();
export const orderService = new OrderService();
