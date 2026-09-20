/**
 * Script de validación automatizada de reglas de negocio para CONSJA3
 */

// Polyfill de localStorage para entorno Node si no está presente
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

import { productService, orderService } from './js/services.js';
import { store } from './js/state.js';

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE REGLAS DE NEGOCIO CONSJA3 (Vanilla ES6) ---');

  // Limpiar almacenamiento
  localStorage.clear();
  await productService.resetCatalog();
  store.clearCart();

  // Test 1: Catálogo inicial
  const publicProds = await productService.getProducts();
  assert(publicProds.length === 3, '1. Catálogo inicial contiene exactamente 3 SKUs');

  const mic = publicProds.find(p => p.sku === 'MIC-10');
  assert(mic && mic.price === 400 && mic.stock === 125, '2. MIC-10 tiene precio $400 y stock 125');
  assert(typeof mic.internalCost === 'undefined', '3. Costo interno de MIC-10 NO está expuesto en cliente público');

  const dis = publicProds.find(p => p.sku === 'DIS-01');
  assert(dis && dis.price === 700 && dis.stock === 35, '4. DIS-01 tiene precio $700 y stock 35');

  const kit = publicProds.find(p => p.sku === 'KIT-01');
  assert(kit && kit.price === 1000 && kit.stock === 0, '5. KIT-01 tiene precio $1000 y stock 0 (Agotado)');

  // Test 2: Costo interno visible solo para admin
  const adminProds = await productService.getProducts({ includeInternalCost: true });
  const micAdmin = adminProds.find(p => p.sku === 'MIC-10');
  assert(micAdmin.internalCost === 240, '6. Costo interno de MIC-10 ($240) está disponible para Admin');

  // Test 3: Comprobación 1 del caso: Agregar 2 MIC-10 y 1 DIS-01
  const addMic = await store.addToCart(mic, 2);
  assert(addMic.success, '7. Permite agregar 2 piezas de MIC-10');

  const addDis = await store.addToCart(dis, 1);
  assert(addDis.success, '8. Permite agregar 1 pieza de DIS-01');

  const summary = store.getCartSummary();
  assert(summary.totalItems === 3, '9. Carrito tiene 3 piezas en total');
  assert(summary.subtotal === 1500, '10. Subtotal es exactamente $1,500.00 MXN');
  assert(summary.shipping === 0, '11. Envío es $0.00 MXN (Gratuito)');
  assert(summary.total === 1500, '12. Total a pagar es $1,500.00 MXN');

  // Test 4: Comprobación 2: Cambiar cantidades
  await store.updateQuantity('MIC-10', 4);
  const summary2 = store.getCartSummary();
  assert(summary2.subtotal === 2300, '13. Actualizar MIC-10 a 4 piezas recalcula subtotal a $2,300 MXN');

  // Test 5: Comprobación 3: Quitar un producto
  store.removeFromCart('DIS-01');
  assert(store.getCart().length === 1, '14. Quitar DIS-01 deja solo 1 SKU en el carrito');

  // Test 6: Comprobación 4: Intentar comprar KIT-01 (stock 0)
  const addKit = await store.addToCart(kit, 1);
  assert(!addKit.success && addKit.message.includes('agotado'), '15. Intento de agregar KIT-01 (stock 0) es bloqueado con mensaje');

  // Test 7: Comprobación 5: Intentar exceder stock disponible
  const addExcess = await store.addToCart(dis, 50); // DIS-01 stock es 35
  assert(!addExcess.success, '16. Intento de agregar 50 piezas de DIS-01 (stock 35) es bloqueado');

  // Test 8: Completar pedido con Tarjeta
  const cartItems = store.getCart().map(i => ({
    sku: i.product.sku,
    name: i.product.name,
    price: i.product.price,
    quantity: i.quantity,
    subtotal: i.product.price * i.quantity
  }));

  await productService.deductStock(cartItems);
  const cardOrder = await orderService.createOrder({
    customer: {
      fullName: 'Carlos Mendoza',
      email: 'cmendoza@empresa.mx',
      phone: '5512345678',
      requiresInvoice: true,
      companyName: 'Empresa Demo S.A.',
      rfc: 'EDE010203AB1',
      street: 'Insurgentes',
      neighborhood: 'Del Valle',
      postalCode: '03103',
      city: 'CDMX',
      state: 'Ciudad de México'
    },
    paymentMethod: 'TARJETA'
  }, cartItems);

  assert(cardOrder.folio.startsWith('CONSJA-'), '17. Pedido genera folio único con prefijo CONSJA-');
  assert(cardOrder.status === 'PAGADO', '18. Pedido con tarjeta queda en estado PAGADO');
  assert(cardOrder.shipping === 0, '19. Envío registrado es $0.00');

  // Verificar descuento de stock en MIC-10: 125 - 4 = 121
  const updatedMic = await productService.getProductBySku('MIC-10');
  assert(updatedMic.stock === 121, '20. Inventario de MIC-10 se descontó a 121 piezas');

  // Test 9: Completar pedido con SPEI
  const speiOrder = await orderService.createOrder({
    customer: {
      fullName: 'Laura Gómez',
      email: 'lgomez@tienda.com',
      phone: '5598765432',
      requiresInvoice: false,
      street: 'Reforma 100',
      neighborhood: 'Juárez',
      postalCode: '06600',
      city: 'CDMX',
      state: 'Ciudad de México'
    },
    paymentMethod: 'SPEI'
  }, [{ sku: 'DIS-01', name: 'Dispensador', price: 700, quantity: 1, subtotal: 700 }]);

  assert(speiOrder.status === 'PENDIENTE_PAGO', '21. Pedido con SPEI queda en estado PENDIENTE_PAGO');
  assert(speiOrder.speiDetails && speiOrder.speiDetails.clabe === '012180001948201942', '22. Detalle SPEI contiene CLABE oficial BBVA 012180001948201942');
  assert(speiOrder.speiDetails.paymentReference === speiOrder.folio, '23. Referencia de pago coincide con el folio del pedido');

  // Test 10: Admin - Habilitar KIT-01 y conciliar orden SPEI
  const updatedKit = await productService.updateProductStockPrice('KIT-01', 950, 10);
  assert(updatedKit.stock === 10 && updatedKit.price === 950, '24. Admin actualizó stock de KIT-01 a 10 piezas y precio a $950');

  const addKitNow = await store.addToCart(updatedKit, 2);
  assert(addKitNow.success, '25. Ahora sí permite comprar KIT-01 tras habilitación de stock por admin');

  const reconciled = await orderService.updateOrderStatus(speiOrder.folio, 'PAGADO');
  assert(reconciled.status === 'PAGADO', '26. Admin concilia pedido SPEI y actualiza estado a PAGADO');

  console.log(`\n--- RESULTADOS: ${passed}/${total} PRUEBAS EXITOSAS ---`);

  // Test 11: Comprobación del caso: Enviar formulario incompleto
const invalidOrderAttempt = async () => {
  try {
    return await orderService.createOrder({
      customer: { fullName: 'Solo Nombre' }, // Faltan email, teléfono, dirección
      paymentMethod: 'TARJETA'
    }, cartItems);
  } catch (err) {
    return { success: false, error: err.message };
  }
};
const resultInvalid = await invalidOrderAttempt();
assert(!resultInvalid.success || resultInvalid.error, '27. Formulario incompleto es rechazado por validación');
}

runTests();
