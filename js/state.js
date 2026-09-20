/**
 * CONSJA Suministros - Manejador de Estado Reactivo (Event-driven Store)
 * CONSJA, S. DE R.L. DE C.V.
 */

import { productService } from './services.js';

const CART_KEY = 'consja_v3_cart';

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

class Store extends EventTarget {
  constructor() {
    super();
    this.cart = this._loadCart();
  }

  _loadCart() {
    try {
      const data = storage.getItem(CART_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveCart() {
    storage.setItem(CART_KEY, JSON.stringify(this.cart));
    this.dispatchEvent(new CustomEvent('cart_updated', {
      detail: {
        cart: this.cart,
        summary: this.getCartSummary()
      }
    }));
  }

  subscribe(event, callback) {
    const handler = (e) => callback(e.detail);
    this.addEventListener(event, handler);
    return () => this.removeEventListener(event, handler);
  }

  getCart() {
    return [...this.cart];
  }

  getCartSummary() {
    const totalItems = this.cart.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = this.cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const shipping = 0; // Regla del caso: Envío gratuito al comprador ($0.00 MXN)
    const total = subtotal + shipping;

    return {
      totalItems,
      subtotal,
      shipping,
      total
    };
  }

  /**
   * Agrega producto al carrito con validación estricta de stock
   */
  async addToCart(product, quantityToAdd = 1) {
    const currentProduct = await productService.getProductBySku(product.sku);
    const availableStock = currentProduct ? currentProduct.stock : product.stock;

    // 1. Validación de producto agotado (ej. KIT-01)
    if (availableStock <= 0) {
      return {
        success: false,
        message: `El producto "${product.name}" (${product.sku}) se encuentra agotado.`
      };
    }

    // 2. Comprobar existencia en carrito actual
    const existingIndex = this.cart.findIndex(i => i.product.sku === product.sku);
    const currentQtyInCart = existingIndex >= 0 ? this.cart[existingIndex].quantity : 0;
    const requestedTotal = currentQtyInCart + quantityToAdd;

    // 3. Validación de límite de inventario
    if (requestedTotal > availableStock) {
      const remainingAllowed = availableStock - currentQtyInCart;
      return {
        success: false,
        message: remainingAllowed <= 0
          ? `Ya alcanzaste el límite disponible en stock (${availableStock} piezas).`
          : `Solo puedes agregar ${remainingAllowed} pieza(s) más. Stock disponible: ${availableStock}.`
      };
    }

    if (existingIndex >= 0) {
      this.cart[existingIndex].quantity = requestedTotal;
      this.cart[existingIndex].product.price = currentProduct ? currentProduct.price : product.price;
    } else {
      this.cart.push({
        product: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          price: currentProduct ? currentProduct.price : product.price,
          stock: availableStock,
          unit: product.unit
        },
        quantity: quantityToAdd
      });
    }

    this._saveCart();
    return {
      success: true,
      message: `Se agregaron ${quantityToAdd} unidad(es) de ${product.name} al carrito.`
    };
  }

  /**
   * Actualiza la cantidad de un ítem en el carrito
   */
  async updateQuantity(sku, newQuantity) {
    const itemIndex = this.cart.findIndex(i => i.product.sku === sku);
    if (itemIndex === -1) {
      return { success: false, message: 'Producto no encontrado en el carrito.' };
    }

    if (newQuantity <= 0) {
      return this.removeFromCart(sku);
    }

    const currentProduct = await productService.getProductBySku(sku);
    const availableStock = currentProduct ? currentProduct.stock : this.cart[itemIndex].product.stock;

    if (newQuantity > availableStock) {
      this.cart[itemIndex].quantity = availableStock;
      this._saveCart();
      return {
        success: false,
        adjusted: true,
        message: `Se ajustó la cantidad al máximo disponible (${availableStock} piezas).`
      };
    }

    this.cart[itemIndex].quantity = newQuantity;
    this._saveCart();
    return { success: true, message: 'Cantidad actualizada correctamente.' };
  }

  removeFromCart(sku) {
    const item = this.cart.find(i => i.product.sku === sku);
    this.cart = this.cart.filter(i => i.product.sku !== sku);
    this._saveCart();
    return {
      success: true,
      message: item ? `${item.product.name} fue retirado del carrito.` : 'Producto retirado.'
    };
  }

  clearCart() {
    this.cart = [];
    this._saveCart();
  }

  async validateCartStock() {
    for (const item of this.cart) {
      const prod = await productService.getProductBySku(item.product.sku);
      if (!prod || prod.stock <= 0) {
        return {
          valid: false,
          message: `El producto ${item.product.name} (${item.product.sku}) ya no cuenta con existencias.`
        };
      }
      if (item.quantity > prod.stock) {
        return {
          valid: false,
          message: `La cantidad solicitada para ${item.product.name} (${item.quantity} pzas) excede el stock actual (${prod.stock} pzas).`
        };
      }
    }
    return { valid: true };
  }
}

export const store = new Store();
