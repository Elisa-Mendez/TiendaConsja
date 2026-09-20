/**
 * CONSJA Suministros - Controlador del Panel de Administración (ES6 Modules)
 * CONSJA, S. DE R.L. DE C.V.
 */

import { productService, orderService } from './services.js';

class AdminDashboard {
  constructor() {
    this.products = [];
    this.orders = [];
    this.dom = {};
  }

  async init() {
    this._cacheDom();
    this._bindEvents();
    await this.loadData();
  }

  _cacheDom() {
    this.dom = {
      productsTableBody: document.getElementById('admin-products-table-body'),
      ordersTableBody: document.getElementById('admin-orders-table-body'),
      ordersCountBadge: document.getElementById('orders-count-badge'),
      statSkus: document.getElementById('stat-skus'),
      statStock: document.getElementById('stat-stock'),
      statOrders: document.getElementById('stat-orders'),
      statRevenue: document.getElementById('stat-revenue'),
      quickEnableKitBtn: document.getElementById('quick-enable-kit-btn'),
      resetCatalogBtn: document.getElementById('reset-catalog-btn'),
      toastContainer: document.getElementById('toast-container')
    };
  }

  _bindEvents() {
    this.dom.quickEnableKitBtn?.addEventListener('click', async () => {
      await this.quickEnableKit();
    });

    this.dom.resetCatalogBtn?.addEventListener('click', async () => {
      if (confirm('¿Deseas restaurar el catálogo a los valores originales (MIC-10: 125, DIS-01: 35, KIT-01: 0)?')) {
        await productService.resetCatalog();
        await this.loadData();
        this.showToast('Catálogo Restablecido', 'Se recuperaron los datos originales del caso.', 'info');
      }
    });
  }

  async loadData() {
    try {
      // En el panel de admin sí solicitamos los costos internos para su visualización confidencial
      this.products = await productService.getProducts({ includeInternalCost: true });
      this.orders = await orderService.getOrders();

      this.renderMetrics();
      this.renderProductsTable();
      this.renderOrdersTable();
    } catch (err) {
      this.showToast('Error al cargar datos', err.message, 'error');
    }
  }

  renderMetrics() {
    const totalStock = this.products.reduce((sum, p) => sum + p.stock, 0);
    const totalRevenue = this.orders.reduce((sum, o) => sum + o.total, 0);

    if (this.dom.statSkus) this.dom.statSkus.textContent = this.products.length;
    if (this.dom.statStock) this.dom.statStock.textContent = totalStock.toLocaleString();
    if (this.dom.statOrders) this.dom.statOrders.textContent = this.orders.length;
    if (this.dom.statRevenue) {
      this.dom.statRevenue.textContent = `$${totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    }
    if (this.dom.ordersCountBadge) {
      this.dom.ordersCountBadge.textContent = `${this.orders.length} Pedido(s)`;
    }
  }

  renderProductsTable() {
    if (!this.dom.productsTableBody) return;

    this.dom.productsTableBody.innerHTML = this.products.map(prod => {
      const isAgotado = prod.stock === 0;
      const isBajo = prod.stock > 0 && prod.stock <= 10;
      
      let badgeHtml = '<span class="order-status-badge pagado">Disponible</span>';
      if (isAgotado) {
        badgeHtml = '<span class="order-status-badge" style="background: var(--rose-soft); color: var(--rose);">Agotado</span>';
      } else if (isBajo) {
        badgeHtml = '<span class="order-status-badge pendiente">Pocas piezas</span>';
      }

      return `
        <tr data-sku="${prod.sku}">
          <td>
            <strong style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--primary);">${prod.sku}</strong>
          </td>
          <td>
            <strong style="color: var(--primary); font-size: 0.9rem; display: block;">${prod.name}</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${prod.description}</span>
          </td>
          <td style="text-align: center;">
            <span class="internal-cost-tag">$${prod.internalCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</span>
            <span class="badge-admin-only">Solo Admin</span>
          </td>
          <td style="text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 0.25rem;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">$</span>
              <input type="number" class="input-admin-edit input-price" value="${prod.price}" min="0" step="10">
            </div>
          </td>
          <td style="text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 0.25rem;">
              <input type="number" class="input-admin-edit input-stock" value="${prod.stock}" min="0" step="1">
              <span style="font-size: 0.75rem; color: var(--text-muted);">pzas</span>
            </div>
          </td>
          <td style="text-align: center;">
            ${badgeHtml}
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn-admin-save btn-save-product" data-sku="${prod.sku}">
              Guardar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this._bindTableEvents();
  }

  _bindTableEvents() {
    this.dom.productsTableBody.querySelectorAll('.btn-save-product').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sku = btn.dataset.sku;
        const row = this.dom.productsTableBody.querySelector(`tr[data-sku="${sku}"]`);
        if (!row) return;

        const priceInput = row.querySelector('.input-price');
        const stockInput = row.querySelector('.input-stock');

        const newPrice = parseFloat(priceInput.value);
        const newStock = parseInt(stockInput.value, 10);

        if (isNaN(newPrice) || newPrice < 0) {
          this.showToast('Precio Inválido', 'Ingresa un precio válido mayor o igual a 0.', 'error');
          return;
        }

        if (isNaN(newStock) || newStock < 0) {
          this.showToast('Stock Inválido', 'Ingresa una cantidad de stock válida.', 'error');
          return;
        }

        btn.disabled = true;
        btn.textContent = '...';

        try {
          const updated = await productService.updateProductStockPrice(sku, newPrice, newStock);
          await this.loadData();
          this.showToast('Inventario Actualizado', `SKU ${updated.sku}: Precio $${updated.price} MXN | Stock: ${updated.stock}`, 'success');
        } catch (err) {
          this.showToast('Error', err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Guardar';
        }
      });
    });
  }

  renderOrdersTable() {
    if (!this.dom.ordersTableBody) return;

    if (this.orders.length === 0) {
      this.dom.ordersTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No hay pedidos registrados en esta sesión. Realiza una compra desde la tienda pública para comprobar el registro.
          </td>
        </tr>
      `;
      return;
    }

    this.dom.ordersTableBody.innerHTML = this.orders.map(order => {
      const isPaid = order.status === 'PAGADO';
      const dateStr = new Date(order.createdAt).toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
      });

      return `
        <tr data-folio="${order.folio}">
          <td>
            <strong style="font-family: var(--font-mono); color: var(--blue); font-size: 0.85rem;">${order.folio}</strong>
          </td>
          <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
            ${dateStr}
          </td>
          <td>
            <strong style="display: block; color: var(--primary);">${order.customer.fullName}</strong>
            ${order.customer.companyName ? `<span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${order.customer.companyName}</span>` : ''}
            <span style="font-size: 0.7rem; color: var(--text-light);">${order.customer.city}, ${order.customer.state}</span>
          </td>
          <td>
            <div style="font-size: 0.75rem;">
              ${order.items.map(it => `<div>${it.quantity}x ${it.sku}</div>`).join('')}
            </div>
          </td>
          <td>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">
              ${order.paymentMethod}
            </span>
          </td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; font-size: 0.9rem;">
            $${order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </td>
          <td style="text-align: center;">
            <span class="order-status-badge ${isPaid ? 'pagado' : 'pendiente'}">
              ${order.status}
            </span>
          </td>
          <td style="text-align: right;">
            ${!isPaid ? `
              <button type="button" class="btn-reconcile btn-confirm-pay" data-folio="${order.folio}" title="Simular confirmación y conciliación de la transferencia SPEI">
                Confirmar Pago
              </button>
            ` : `
              <span style="font-size: 0.75rem; color: var(--emerald); font-weight: 700;">✓ Conciliado</span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    this._bindOrderEvents();
  }

  _bindOrderEvents() {
    this.dom.ordersTableBody.querySelectorAll('.btn-confirm-pay').forEach(btn => {
      btn.addEventListener('click', async () => {
        const folio = btn.dataset.folio;
        btn.disabled = true;
        btn.textContent = '...';

        try {
          await orderService.updateOrderStatus(folio, 'PAGADO');
          await this.loadData();
          this.showToast('Pago Conciliado', `El pedido ${folio} ha sido marcado como PAGADO.`, 'success');
        } catch (err) {
          this.showToast('Error', err.message, 'error');
        }
      });
    });
  }

  async quickEnableKit() {
    try {
      const kit = this.products.find(p => p.sku === 'KIT-01');
      const price = kit ? kit.price : 1000;
      await productService.updateProductStockPrice('KIT-01', price, 10);
      await this.loadData();
      this.showToast('KIT-01 Habilitado', 'Se asignaron 10 piezas en inventario para KIT-01. Ya puede comprarse en la tienda pública.', 'success');
    } catch (err) {
      this.showToast('Error', err.message, 'error');
    }
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

document.addEventListener('DOMContentLoaded', () => {
  const admin = new AdminDashboard();
  admin.init();
});
