/**
 * CONSJA Suministros - Controlador Principal de la Tienda (ES6 Modules)
 * CONSJA, S. DE R.L. DE C.V.
 */

import { productService, orderService } from './services.js';
import { store } from './state.js';

// Lista oficial de 32 entidades federativas de México
const ESTADOS_MEXICO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
];

class App {
  constructor() {
    this.products = [];
    this.selectedPayment = 'TARJETA';
    this.currentQuantities = {}; // SKU -> number
    this.currentDiscount = 0;
    this.dom = {};
  }

  async init() {
    this._cacheDom();
    this._bindEvents();
    this._populateStates();
    this._renderCart(store.getCart(), store.getCartSummary());
    await this.loadCatalog();
  }

  _cacheDom() {
    this.dom = {
      productsContainer: document.getElementById('products-container'),
      cartCounter: document.getElementById('cart-counter'),
      openCartBtn: document.getElementById('open-cart-btn'),
      heroCartBtn: document.getElementById('hero-cart-btn'),
      closeCartBtn: document.getElementById('close-cart-btn'),
      cartDrawer: document.getElementById('cart-drawer'),
      cartOverlay: document.getElementById('cart-overlay'),
      cartItemsContainer: document.getElementById('cart-items-container'),
      cartFooter: document.getElementById('cart-footer'),
      cartSubtotal: document.getElementById('cart-subtotal'),
      cartTotal: document.getElementById('cart-total'),
      proceedCheckoutBtn: document.getElementById('proceed-checkout-btn'),

      // descuento comercial
      discountCodeInput: document.getElementById('discount-code-input'),
      applyDiscountBtn: document.getElementById('apply-discount-btn'),
      discountMessage: document.getElementById('discount-message'),
      discountRow: document.getElementById('discount-row'),
      discountAmount: document.getElementById('discount-amount'),


      // Checkout Modal
      checkoutModal: document.getElementById('checkout-modal'),
      closeCheckoutBtn: document.getElementById('close-checkout-btn'),
      checkoutForm: document.getElementById('checkout-form'),
      requireInvoiceCheck: document.getElementById('require-invoice-check'),
      invoiceFields: document.getElementById('invoice-fields'),
      paymentOptCard: document.getElementById('payment-opt-card'),
      paymentOptSpei: document.getElementById('payment-opt-spei'),
      cardSimulatedFields: document.getElementById('card-simulated-fields'),
      speiNotice: document.getElementById('spei-notice'),
      submitOrderBtn: document.getElementById('submit-order-btn'),

      // Confirmation Modal
      confirmationModal: document.getElementById('confirmation-modal'),
      closeConfirmationBtn: document.getElementById('close-confirmation-btn'),
      confirmationContent: document.getElementById('confirmation-content'),

      // Mobile
      mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
      mobileNav: document.getElementById('mobile-nav'),

      // Toasts
      toastContainer: document.getElementById('toast-container')
    };
  }

  _bindEvents() {
    // Sincronización reactiva del carrito
    store.subscribe('cart_updated', ({ cart, summary }) => {
      this._renderCart(cart, summary);
    });

    // Abrir/Cerrar Carrito Drawer
    const openCart = () => {
      this.dom.cartDrawer.classList.add('open');
      this.dom.cartOverlay.classList.add('open');
    };
    const closeCart = () => {
      this.dom.cartDrawer.classList.remove('open');
      this.dom.cartOverlay.classList.remove('open');
    };

    this.dom.openCartBtn?.addEventListener('click', openCart);
    this.dom.heroCartBtn?.addEventListener('click', openCart);
    this.dom.closeCartBtn?.addEventListener('click', closeCart);
    this.dom.cartOverlay?.addEventListener('click', closeCart);

    // Mobile nav toggle
    this.dom.mobileMenuToggle?.addEventListener('click', () => {
      this.dom.mobileNav.classList.toggle('open');
    });

    //validación de descuento comercial
    this.dom.applyDiscountBtn?.addEventListener('click', () => {
      this.applyCommercialDiscount(this.dom.discountCodeInput?.value || '');
    });

    // Ir a Checkout desde el carrito
    this.dom.proceedCheckoutBtn?.addEventListener('click', async () => {
      const stockCheck = await store.validateCartStock();
      if (!stockCheck.valid) {
        this.showToast('Inventario no disponible', stockCheck.message, 'error');
        return;
      }
      closeCart();
      this.openCheckoutModal();
    });

    // Cerrar Checkout
    this.dom.closeCheckoutBtn?.addEventListener('click', () => {
      this.closeCheckoutModal();
    });

    // Toggle de Facturación
    this.dom.requireInvoiceCheck?.addEventListener('change', (e) => {
      const req = e.target.checked;
      this.dom.invoiceFields.style.display = req ? 'grid' : 'none';
      const companyInput = this.dom.checkoutForm.querySelector('[name="companyName"]');
      const rfcInput = this.dom.checkoutForm.querySelector('[name="rfc"]');
      if (req) {
        companyInput.setAttribute('required', 'true');
        rfcInput.setAttribute('required', 'true');
      } else {
        companyInput.removeAttribute('required');
        rfcInput.removeAttribute('required');
      }
    });

    // Toggle de Métodos de Pago
    this.dom.paymentOptCard?.addEventListener('click', () => this.setPaymentMethod('TARJETA'));
    this.dom.paymentOptSpei?.addEventListener('click', () => this.setPaymentMethod('SPEI'));

    // Envío del Checkout Form
    this.dom.checkoutForm?.addEventListener('submit', (e) => this.handleCheckoutSubmit(e));

    // Cerrar Confirmación
    this.dom.closeConfirmationBtn?.addEventListener('click', () => {
      this.closeConfirmationModal();
    });
  }

  _populateStates() {
    const stateSelect = this.dom.checkoutForm?.querySelector('[name="state"]');
    if (!stateSelect) return;
    stateSelect.innerHTML = ESTADOS_MEXICO.map(st =>
      `<option value="${st}" ${st === 'Ciudad de México' ? 'selected' : ''}>${st}</option>`
    ).join('');
  }

  setPaymentMethod(method) {
    this.selectedPayment = method;
    if (method === 'TARJETA') {
      this.dom.paymentOptCard.classList.add('active');
      this.dom.paymentOptSpei.classList.remove('active');
      this.dom.cardSimulatedFields.style.display = 'block';
      this.dom.speiNotice.style.display = 'none';
    } else {
      this.dom.paymentOptCard.classList.remove('active');
      this.dom.paymentOptSpei.classList.add('active');
      this.dom.cardSimulatedFields.style.display = 'none';
      this.dom.speiNotice.style.display = 'block';
    }
  }

  applyCommercialDiscount(inputVal) {
    const msgEl = this.dom.discountMessage;
    const cleanVal = inputVal.trim().toUpperCase();

    if (!msgEl) return;
    msgEl.className = 'discount-message';

    if (cleanVal === 'DESC5' || cleanVal === '5' || cleanVal === '5%') {
      this.currentDiscount = 0.05;
      msgEl.classList.add('discount-message-success');
      msgEl.textContent = '✓ Descuento del 5% aplicado dentro de la política comercial autorizada.';
      this.showToast('Descuento aplicado', 'Se aplicó el 5% de descuento comercial.', 'success');
    } else if (cleanVal === 'DESC10' || cleanVal === '10' || cleanVal === '10%') {
      this.currentDiscount = 0;
      msgEl.classList.add('discount-message-error');
      msgEl.innerHTML = '⚠️ <strong>Tope excedido:</strong> Descuentos mayores al 5% requieren aprobación de gerencia.';
      this.showToast('Tope no autorizado', 'Descuentos mayores al 5% requieren autorización.', 'warning');
    } else {
      this.currentDiscount = 0;
      msgEl.classList.add('discount-message-error');
      msgEl.textContent = 'Código inválido. Usa "DESC5" para el 5% autorizado.';
    }

    // Re-renderizar carrito con los nuevos totales
    this._renderCart(store.getCart(), store.getCartSummary());
  }

  async loadCatalog() {
    try {
      this.products = await productService.getProducts();
      this.renderProducts();
    } catch (err) {
      this.dom.productsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--rose); padding: 2rem;">
          Error al cargar catálogo: ${err.message}
        </div>
      `;
    }
  }

  renderProducts() {
    if (!this.products || this.products.length === 0) {
      this.dom.productsContainer.innerHTML = '<p>No hay productos disponibles.</p>';
      return;
    }

    this.dom.productsContainer.innerHTML = this.products.map(product => {
      const isOut = product.stock <= 0;
      const initialQty = this.currentQuantities[product.sku] || (isOut ? 0 : 1);
      this.currentQuantities[product.sku] = initialQty;

      // Status stock tag
      let stockTagHtml = '';
      if (product.stock > 10) {
        stockTagHtml = `<span class="stock-tag in-stock">Stock: ${product.stock} pzas</span>`;
      } else if (product.stock > 0) {
        stockTagHtml = `<span class="stock-tag low-stock">Solo ${product.stock} pzas</span>`;
      } else {
        stockTagHtml = `<span class="stock-tag out">Agotado (0 pzas)</span>`;
      }

      // Badge tag
      let badgeHtml = '';
      if (product.badge) {
        let badgeClass = 'mas-vendido';
        if (product.badge === 'Existencia Limitada') badgeClass = 'limitada';
        if (product.badge === 'Agotado') badgeClass = 'agotado';
        badgeHtml = `<span class="badge-tag ${badgeClass}">${product.badge}</span>`;
      }

      // Vector Icon
      let avatarClass = 'mic';
      let avatarIcon = '10 pcs';
      if (product.sku === 'DIS-01') { avatarClass = 'dis'; avatarIcon = '1 Litro'; }
      if (product.sku === 'KIT-01') { avatarClass = 'kit'; avatarIcon = 'Combo'; }

      return `
        <article class="product-card ${isOut ? 'out-of-stock' : ''}" data-sku="${product.sku}">
          <div class="card-media">
            <div class="card-top-left">
              <span class="sku-tag">SKU: ${product.sku}</span>
              ${badgeHtml}
            </div>
            ${stockTagHtml}

            <!-- Visual Avatar Icon -->
            <div class="card-image-wrapper">
              <img
                src="${product.image}" 
                alt="${product.name}" 
                class="product-image"
                loading="lazy"
              >
            </div>
          </div>

          <div class="card-body">
            <div>
              <p class="product-category">${product.category} · ${product.unit}</p>
              <h4 class="product-name">${product.name}</h4>
              <p class="product-desc">${product.description}</p>

              <div class="features-box">
                <h5>Características confirmadas:</h5>
                <ul class="features-list">
                  ${product.features.map(f => `<li>${f}</li>`).join('')}
                </ul>
              </div>
            </div>

            <div class="card-footer">
              <div class="price-row">
                <div class="price-box">
                  <span class="price-label">Precio unitario neto</span>
                  <div class="price-value">
                    $${product.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    <span class="currency">MXN</span>
                  </div>
                </div>
                <span class="tag-free-shipping" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">
                  Envío Gratis
                </span>
              </div>

              ${!isOut ? `
                <div class="action-row">
                  <div class="stepper">
                    <button type="button" class="stepper-btn btn-dec" data-sku="${product.sku}" ${initialQty <= 1 ? 'disabled' : ''}>-</button>
                    <input type="number" class="stepper-input input-qty" data-sku="${product.sku}" value="${initialQty}" min="1" max="${product.stock}">
                    <button type="button" class="stepper-btn btn-inc" data-sku="${product.sku}" ${initialQty >= product.stock ? 'disabled' : ''}>+</button>
                  </div>
                  <button type="button" class="btn-add-cart" data-sku="${product.sku}">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                    <span>Agregar</span>
                  </button>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-light); text-align: center; margin-top: 0.4rem;">
                  Existencia máxima: ${product.stock} pzas
                </div>
              ` : `
                <div>
                  <button type="button" class="btn-add-cart" disabled style="width: 100%;">
                    <span>Producto Agotado</span>
                  </button>
                  <p style="font-size: 0.7rem; color: var(--rose); text-align: center; margin-top: 0.4rem; font-weight: 600;">
                    Sin fecha confirmada de reposición
                  </p>
                </div>
              `}
            </div>
          </div>
        </article>
      `;
    }).join('');

    this._bindProductInteractions();
  }

  _bindProductInteractions() {
    // Stepper decrementar
    this.dom.productsContainer.querySelectorAll('.btn-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.dataset.sku;
        const current = this.currentQuantities[sku] || 1;
        if (current > 1) {
          this.currentQuantities[sku] = current - 1;
          this._updateProductCardStepper(sku);
        }
      });
    });

    // Stepper incrementar
    this.dom.productsContainer.querySelectorAll('.btn-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.dataset.sku;
        const prod = this.products.find(p => p.sku === sku);
        const current = this.currentQuantities[sku] || 1;
        if (prod && current < prod.stock) {
          this.currentQuantities[sku] = current + 1;
          this._updateProductCardStepper(sku);
        }
      });
    });

    // Stepper input manual
    this.dom.productsContainer.querySelectorAll('.input-qty').forEach(input => {
      input.addEventListener('change', () => {
        const sku = input.dataset.sku;
        const prod = this.products.find(p => p.sku === sku);
        let val = parseInt(input.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (prod && val > prod.stock) val = prod.stock;
        this.currentQuantities[sku] = val;
        this._updateProductCardStepper(sku);
      });
    });

    // Botón Agregar al Carrito
    this.dom.productsContainer.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sku = btn.dataset.sku;
        const prod = this.products.find(p => p.sku === sku);
        if (!prod) return;

        const qty = this.currentQuantities[sku] || 1;
        const result = await store.addToCart(prod, qty);
        if (result.success) {
          this.showToast('Agregado con éxito', result.message, 'success');
        } else {
          this.showToast('No fue posible agregar', result.message, 'warning');
        }
      });
    });
  }

  _updateProductCardStepper(sku) {
    const card = this.dom.productsContainer.querySelector(`.product-card[data-sku="${sku}"]`);
    if (!card) return;
    const prod = this.products.find(p => p.sku === sku);
    const qty = this.currentQuantities[sku] || 1;
    const input = card.querySelector('.input-qty');
    const decBtn = card.querySelector('.btn-dec');
    const incBtn = card.querySelector('.btn-inc');

    if (input) input.value = qty;
    if (decBtn) decBtn.disabled = qty <= 1;
    if (incBtn && prod) incBtn.disabled = qty >= prod.stock;
  }

  _renderCart(cart, summary) {
    // 1. Contador del header
    if (this.dom.cartCounter) {
      this.dom.cartCounter.textContent = summary.totalItems;
      if (summary.totalItems > 0) {
        this.dom.cartCounter.classList.remove('zero');
      } else {
        this.dom.cartCounter.classList.add('zero');
      }
    }

    // 2. Lista de ítems en el drawer
    if (!this.dom.cartItemsContainer) return;

    if (cart.length === 0) {
      this.dom.cartItemsContainer.innerHTML = `
        <div class="empty-cart-view">
          <div class="empty-cart-icon">
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
            </svg>
          </div>
          <p style="font-weight: 700; color: var(--primary);">Tu carrito está vacío</p>
          <p style="font-size: 0.8rem;">Selecciona productos de nuestro catálogo para comenzar tu compra.</p>
        </div>
      `;
      this.dom.cartFooter.style.display = 'none';
      return;
    }

    this.dom.cartFooter.style.display = 'flex';

    // Cálculo con descuento comercial
    const subtotal = summary.subtotal;
    const discountVal = subtotal * this.currentDiscount;
    const finalTotal = subtotal - discountVal;

    this.dom.cartSubtotal.textContent = `$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;

    if (this.currentDiscount > 0 && this.dom.discountRow && this.dom.discountAmount) {
      this.dom.discountRow.hidden = false;
      this.dom.discountAmount.textContent = `-$${discountVal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;
    } else if (this.dom.discountRow) {
      this.dom.discountRow.hidden = true;
    }

    this.dom.cartTotal.textContent = `$${finalTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;

    this.dom.cartItemsContainer.innerHTML = cart.map(item => {
      const itemSubtotal = item.product.price * item.quantity;
      const isAtMax = item.quantity >= item.product.stock;
      const isAtMin = item.quantity <= 1;

      return `
        <div class="cart-item-card" data-sku="${item.product.sku}">
          <div class="cart-item-info">
            <span class="cart-item-sku">${item.product.sku}</span>
            <h5 class="cart-item-title">${item.product.name}</h5>
            <div class="cart-item-price">
              $${item.product.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN c/u
            </div>

            <div class="cart-item-actions">
              <div class="stepper" style="transform: scale(0.9); transform-origin: left center;">
                <button type="button" class="stepper-btn cart-dec" data-sku="${item.product.sku}" ${isAtMin ? 'disabled' : ''}>-</button>
                <input type="number" class="stepper-input cart-qty-input" data-sku="${item.product.sku}" value="${item.quantity}" min="1" max="${item.product.stock}">
                <button type="button" class="stepper-btn cart-inc" data-sku="${item.product.sku}" ${isAtMax ? 'disabled' : ''} title="${isAtMax ? 'Stock máximo alcanzado' : ''}">+</button>
              </div>

              <div style="text-align: right;">
                <div style="font-family: var(--font-mono); font-weight: 800; font-size: 0.9rem; color: var(--primary);">
                  $${itemSubtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </div>
                <button type="button" class="btn-remove-item cart-remove" data-sku="${item.product.sku}">
                  Quitar
                </button>
              </div>
            </div>

            ${isAtMax ? `
              <span class="stock-limit-badge">
                ⚠️ Stock máximo alcanzado (${item.product.stock} piezas disp.)
              </span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    this._bindCartInteractions();
  }

  _bindCartInteractions() {
    this.dom.cartItemsContainer.querySelectorAll('.cart-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.dataset.sku;
        const item = store.getCart().find(i => i.product.sku === sku);
        if (item) store.updateQuantity(sku, item.quantity - 1);
      });
    });

    this.dom.cartItemsContainer.querySelectorAll('.cart-inc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sku = btn.dataset.sku;
        const item = store.getCart().find(i => i.product.sku === sku);
        if (item) {
          const res = await store.updateQuantity(sku, item.quantity + 1);
          if (res.adjusted) this.showToast('Tope de stock', res.message, 'warning');
        }
      });
    });

    this.dom.cartItemsContainer.querySelectorAll('.cart-qty-input').forEach(input => {
      input.addEventListener('change', async () => {
        const sku = input.dataset.sku;
        let val = parseInt(input.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        const res = await store.updateQuantity(sku, val);
        if (res.adjusted) this.showToast('Tope de stock', res.message, 'warning');
      });
    });

    this.dom.cartItemsContainer.querySelectorAll('.cart-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.dataset.sku;
        store.removeFromCart(sku);
        this.showToast('Producto retirado', 'Se quitó el artículo de tu carrito.', 'info');
      });
    });
  }

  openCheckoutModal() {
    this.dom.checkoutModal.classList.add('open');
  }

  closeCheckoutModal() {
    this.dom.checkoutModal.classList.remove('open');
  }

  async handleCheckoutSubmit(e) {
    e.preventDefault();
    const form = this.dom.checkoutForm;

    // Validación básica de HTML5
    if (!form.checkValidity()) {
      form.reportValidity();
      this.showToast('Formulario Incompleto', 'Por favor llena todos los campos obligatorios correctamente.', 'error');
      return;
    }

    const formData = new FormData(form);
    const requiresInvoice = this.dom.requireInvoiceCheck.checked;
    const fullName = formData.get('fullName')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const phone = formData.get('phone')?.toString().trim();
    const companyName = formData.get('companyName')?.toString().trim();
    const rfc = formData.get('rfc')?.toString().trim().toUpperCase();

    // Validar teléfono mexicano (10 dígitos)
    if (!/^[0-9]{10}$/.test(phone)) {
      this.showToast('Teléfono Inválido', 'Ingresa los 10 dígitos numéricos de tu teléfono.', 'error');
      return;
    }

    // Validar RFC si requiere factura
    if (requiresInvoice) {
      if (!companyName) {
        this.showToast('Razón Social requerida', 'Ingresa el nombre o razón social fiscal para emitir tu factura.', 'error');
        return;
      }
      if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc)) {
        this.showToast('RFC Inválido', 'El RFC ingresado no cumple con el formato fiscal oficial del SAT (12 o 13 caracteres).', 'error');
        return;
      }
    }

    // Validar stock antes de crear la orden
    const stockValidation = await store.validateCartStock();
    if (!stockValidation.valid) {
      this.showToast('Error de inventario', stockValidation.message, 'error');
      return;
    }

    this.dom.submitOrderBtn.disabled = true;
    this.dom.submitOrderBtn.textContent = 'Procesando Pedido...';

    const orderCustomer = {
      fullName,
      email,
      phone,
      requiresInvoice,
      companyName: requiresInvoice ? companyName : undefined,
      rfc: requiresInvoice ? rfc : undefined,
      street: formData.get('street')?.toString().trim(),
      neighborhood: formData.get('neighborhood')?.toString().trim(),
      postalCode: formData.get('postalCode')?.toString().trim(),
      city: formData.get('city')?.toString().trim(),
      state: formData.get('state')?.toString().trim()
    };

    const cartItems = store.getCart().map(i => ({
      sku: i.product.sku,
      name: i.product.name,
      price: i.product.price,
      quantity: i.quantity,
      subtotal: i.product.price * i.quantity
    }));

    try {
      // 1. Deducir stock en la capa de servicios
      await productService.deductStock(cartItems);

      // 2. Crear pedido oficial
      const order = await orderService.createOrder({
        customer: orderCustomer,
        paymentMethod: this.selectedPayment,
        discountApplied: this.currentDiscount
      }, cartItems);

      // 3. Limpiar carrito
      this.currentDiscount = 0;
      if (this.dom.discountCodeInput) this.dom.discountCodeInput.value = '';
      if (this.dom.discountMessage) this.dom.discountMessage.className = 'discount-message';
      store.clearCart();

      // 4. Cerrar checkout y abrir confirmación
      this.closeCheckoutModal();
      this.openConfirmationModal(order);

      // 5. Recargar catálogo para refrescar los stocks visuales
      await this.loadCatalog();

      this.showToast('¡Pedido Registrado!', `Folio ${order.folio} generado con éxito.`, 'success');
    } catch (err) {
      this.showToast('Error al procesar pedido', err.message, 'error');
    } finally {
      this.dom.submitOrderBtn.disabled = false;
      this.dom.submitOrderBtn.textContent = 'Confirmar y Generar Pedido';
    }
  }

  openConfirmationModal(order) {
    const isSpei = order.paymentMethod === 'SPEI';

    this.dom.confirmationContent.innerHTML = `
      <div class="confirmation-box">
        <div style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--emerald); letter-spacing: 0.05em;">
          ✓ Registro Exitoso
        </div>
        <h4 style="font-size: 1.35rem; font-weight: 900; color: var(--primary); margin-top: 0.25rem;">
          CONSJA Suministros
        </h4>
        <div class="folio-badge">${order.folio}</div>
        <p style="font-size: 0.8rem; color: var(--text-muted);">
          Fecha: ${new Date(order.createdAt).toLocaleString('es-MX')} | 
          Estado: <strong style="color: ${order.status === 'PAGADO' ? 'var(--emerald)' : 'var(--accent)'};">${order.status}</strong>
        </p>
      </div>

      <div class="delivery-alert-box">
        <strong>Compromiso Oficial de Entrega:</strong> Estimada de <strong>3 a 5 días hábiles</strong> posteriores a la confirmación de pago. (No se garantiza entrega al día siguiente).
      </div>

      ${isSpei && order.speiDetails ? `
        <div style="background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <strong style="font-size: 0.85rem; color: var(--primary); display: block; margin-bottom: 0.5rem;">
            🏦 Instrucciones Oficiales para Transferencia SPEI
          </strong>
          <table class="spei-table">
            <tr>
              <td>Banco:</td>
              <td>${order.speiDetails.bankName}</td>
            </tr>
            <tr>
              <td>CLABE (18 dígitos):</td>
              <td><strong style="color: var(--blue);">${order.speiDetails.clabe}</strong></td>
            </tr>
            <tr>
              <td>Beneficiario:</td>
              <td>${order.speiDetails.accountHolder}</td>
            </tr>
            <tr>
              <td>Concepto / Referencia:</td>
              <td><strong style="color: var(--accent);">${order.speiDetails.paymentReference}</strong></td>
            </tr>
            <tr>
              <td>Monto a Transferir:</td>
              <td><strong>$${order.speiDetails.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</strong></td>
            </tr>
          </table>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
            * Tu pedido iniciará su preparación en cuanto se concilie la transferencia bancaria.
          </p>
        </div>
      ` : `
        <div style="background: var(--emerald-soft); border: 1px solid rgba(5, 150, 105, 0.3); padding: 0.85rem; border-radius: var(--radius-sm); font-size: 0.8rem; color: #065f46;">
          ✓ <strong>Pago con Tarjeta Aprobado:</strong> La transacción simulada fue exitosa. Tu pedido ha sido enviado a empaque en nuestro centro de distribución en CDMX.
        </div>
      `}

      <div>
        <h5 style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">
          Desglose de Artículos Comprados
        </h5>
        <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden;">
          <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
            <thead style="background: var(--bg-main); font-weight: 700; text-align: left;">
              <tr>
                <th style="padding: 0.5rem 0.75rem;">SKU</th>
                <th style="padding: 0.5rem 0.75rem;">Descripción</th>
                <th style="padding: 0.5rem 0.75rem; text-align: center;">Cant.</th>
                <th style="padding: 0.5rem 0.75rem; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(it => `
                <tr style="border-top: 1px solid var(--border-light);">
                  <td style="padding: 0.5rem 0.75rem; font-family: var(--font-mono); font-weight: 700;">${it.sku}</td>
                  <td style="padding: 0.5rem 0.75rem;">${it.name}</td>
                  <td style="padding: 0.5rem 0.75rem; text-align: center; font-weight: 700;">${it.quantity}</td>
                  <td style="padding: 0.5rem 0.75rem; text-align: right; font-family: var(--font-mono);">$${it.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot style="border-top: 1px solid var(--border); font-weight: 700; background: var(--bg-main);">
              <tr>
                <td colspan="3" style="padding: 0.5rem 0.75rem; text-align: right;">Envío Gratuito:</td>
                <td style="padding: 0.5rem 0.75rem; text-align: right; color: var(--emerald);">$0.00 MXN</td>
              </tr>
              <tr style="font-size: 0.95rem; font-weight: 900;">
                <td colspan="3" style="padding: 0.65rem 0.75rem; text-align: right;">Total Neto Pagado:</td>
                <td style="padding: 0.65rem 0.75rem; text-align: right; font-family: var(--font-mono);">$${order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem;">
        <button type="button" class="btn-secondary btn-print" onclick="window.print()" style="color: var(--primary); border-color: var(--border);">
          🖨 Imprimir Recibo
        </button>
        <button type="button" class="btn-primary" id="finish-btn">
          Aceptar y Continuar
        </button>
      </div>
    `;

    document.getElementById('finish-btn')?.addEventListener('click', () => {
      this.closeConfirmationModal();
    });

    this.dom.confirmationModal.classList.add('open');
  }

  closeConfirmationModal() {
    this.dom.confirmationModal.classList.remove('open');
  }

  showToast(title, message, type = 'success', duration = 3500) {
    if (!this.dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <strong>${title}</strong>
        <p>${message}</p>
      </div>
    `;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(1rem)';
      toast.style.transition = 'all 0.2s ease-out';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
