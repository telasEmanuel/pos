<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import api from 'src/api/axios';
import { useQuasar, date } from 'quasar';
import ReceiptPrinter from 'src/components/ReceiptPrinter.vue';
import type { ReceiptData } from 'src/components/types';

// Interfaces based on API introspection
interface DetalleVenta {
  id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  medida?: string;
  producto?: {
    nombre: string;
  };
}

interface Venta {
  id: number;
  fecha_venta: string;
  cliente: string | null;
  total: number;
  comentarios: string | null;
  metodo_pago: string;
  detallesVenta: DetalleVenta[];
}

interface CorteResponse {
  ventas: Venta[];
  stats: {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    usd: number;
    granTotal: number;
  };
}

const $q = useQuasar();
const ventas = ref<Venta[]>([]);
const stats = ref({
  efectivo: 0,
  tarjeta: 0,
  transferencia: 0,
  usd: 0,
  granTotal: 0
});
const loading = ref(true);
const productosMap = ref<Map<number, string>>(new Map());
const medidasMap = ref<Map<number, string>>(new Map());
const receiptPrinter = ref<InstanceType<typeof ReceiptPrinter> | null>(null);
const lastReceipt = ref<ReceiptData | null>(null);

// Date selection
const today = date.formatDate(Date.now(), 'YYYY/MM/DD');
const dateRange = ref<string | { from: string; to: string }>(today);

const displayDate = computed(() => {
  if (typeof dateRange.value === 'string') {
    return dateRange.value;
  }
  return `${dateRange.value.from} - ${dateRange.value.to}`;
});

const formatCurrency = (amount: number | string | undefined | null) => {
  if (amount === undefined || amount === null) return '$0.00';
  return Number(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
};

const formatNumber = (val: number | undefined | null) => {
  if (val === undefined || val === null) return '0.00';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatTime = (dateString: string | undefined | null) => {
  if (!dateString) return '';
  return date.formatDate(dateString, 'HH:mm A');
};

const formatDateLong = (dateString: string | undefined | null) => {
  if (!dateString) return '';
  return date.formatDate(dateString, 'DD/MM/YYYY');
};

const parseDetailedPaymentComment = (rawComment: string | null): {
  comments: string;
  pagoDetalle?: ReceiptData['pagoDetalle'];
} => {
  const comment = rawComment ?? '';
  const detailMatch = comment.match(/\[Detalle Pago:([^\]]+)\]/i);

  if (!detailMatch || !detailMatch[1]) {
    return { comments: comment.trim() };
  }

  const detailText = detailMatch[1];

  const parseAmount = (regex: RegExp): number => {
    const match = detailText.match(regex);
    if (!match || !match[1]) return 0;
    const value = parseFloat(match[1]);
    return Number.isFinite(value) ? value : 0;
  };

  const efectivo = parseAmount(/Pesos:\s*\$([\d.]+)/i);
  const dolares = parseAmount(/USD:\s*([\d.]+)/i);
  const tasaCambio = parseAmount(/\(Tasa:\s*([\d.]+)\)/i);
  const tarjeta = parseAmount(/Tarjeta:\s*\$([\d.]+)/i);
  const transferencia = parseAmount(/Transf:\s*\$([\d.]+)/i);
  const totalPagado = efectivo + tarjeta + transferencia + (dolares * tasaCambio);

  const cleanedComment = comment
    .replace(detailMatch[0], '')
    .trim();

  return {
    comments: cleanedComment,
    pagoDetalle: {
      efectivo,
      tarjeta,
      transferencia,
      dolares,
      tasaCambio,
      totalPagado: Number(totalPagado.toFixed(2)),
    }
  };
};

const buildLastReceiptFromVenta = (venta: Venta): ReceiptData => {
  const parsed = parseDetailedPaymentComment(venta.comentarios);

  return {
    cliente: (venta.cliente || 'Cliente General').trim(),
    productos: (venta.detallesVenta || []).map((detalle) => ({
      cantidad: Number(detalle.cantidad || 0),
      medida: (detalle.medida || getProductoMedida(detalle.producto_id)).trim(),
      nombre: getProductoNombre(detalle.producto_id),
      precio_unitario: Number(detalle.precio_unitario || 0),
    })),
    total: Number(venta.total || 0),
    metodoPago: String(venta.metodo_pago || 'EFECTIVO').toUpperCase(),
    fecha: venta.fecha_venta,
    ticketId: venta.id,
    ...(parsed.comments ? { comentarios: parsed.comments } : {}),
    ...(parsed.pagoDetalle ? { pagoDetalle: parsed.pagoDetalle } : {}),
  };
};

const updateLastReceipt = () => {
  const latestSale = ventas.value[0];
  lastReceipt.value = latestSale ? buildLastReceiptFromVenta(latestSale) : null;
};

const loadVentas = async () => {
  loading.value = true;
  try {
    let inicio, fin;
    if (typeof dateRange.value === 'string') {
      inicio = fin = dateRange.value.replace(/\//g, '-');
    } else {
      inicio = dateRange.value.from.replace(/\//g, '-');
      fin = dateRange.value.to.replace(/\//g, '-');
    }

    const { data } = await api.get<CorteResponse>('ventas/rango', {
      params: { inicio, fin }
    });

    ventas.value = data.ventas;
    stats.value = data.stats;
    updateLastReceipt();
  } catch (error) {
    console.error(error);
    $q.notify({
      message: 'Error al cargar el historial de ventas',
      color: 'negative',
      icon: 'error'
    });
  } finally {
    loading.value = false;
  }
};

const loadProductos = async () => {
  try {
    const res = await api.get('inventarios');
    const items = Array.isArray(res.data) ? res.data : (res.data.items ?? []);

    items.forEach((item: { producto_id?: number; producto?: { id?: number; nombre?: string; medida?: string; medida_ind?: string }; medida?: string; medida_ind?: string }) => {
      const productoId = item.producto_id ?? item.producto?.id;
      const nombre = item.producto?.nombre;
      const medida = item.medida || item.medida_ind || item.producto?.medida || item.producto?.medida_ind || 'pieza';
      if (productoId && nombre) {
        productosMap.value.set(productoId, nombre);
        medidasMap.value.set(productoId, medida.trim());
      }
    });
    updateLastReceipt();
  } catch (error) {
    console.error('Error al cargar productos:', error);
  }
};

const getProductoNombre = (productoId: number): string => {
  return productosMap.value.get(productoId) || `Producto #${productoId}`;
};

const getProductoMedida = (productoId: number): string => {
  return medidasMap.value.get(productoId) || 'pieza';
};

const printLastReceipt = () => {
  if (!lastReceipt.value) {
    $q.notify({
      message: 'No hay recibos recientes para imprimir',
      color: 'warning',
      icon: 'warning'
    });
    return;
  }
  receiptPrinter.value?.print();
};

const printVenta = async (venta: Venta) => {
  lastReceipt.value = buildLastReceiptFromVenta(venta);
  await nextTick();
  receiptPrinter.value?.print();
};

const formatMoney = (amount: number) => `$${Number(amount || 0).toFixed(2)}`;

const generateDailyReportHTML = () => {
  const fechaGeneracion = new Date();
  const dia = String(fechaGeneracion.getDate()).padStart(2, '0');
  const mes = String(fechaGeneracion.getMonth() + 1).padStart(2, '0');
  const anio = fechaGeneracion.getFullYear();
  const horas = String(fechaGeneracion.getHours()).padStart(2, '0');
  const minutos = String(fechaGeneracion.getMinutes()).padStart(2, '0');
  const fechaFormateada = `${dia}/${mes}/${anio} ${horas}:${minutos}`;

  return `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        html, body {
          width: 70mm;
          margin: 0;
          padding: 0;
          color: #000 !important;
        }
        @page {
          size: 70mm auto;
          margin: 0;
        }
        body {
          font-family: Consolas, 'Courier New', monospace;
          font-size: 12px;
          max-width: 70mm;
          overflow: hidden;
          line-height: 1.3;
          color: #000 !important;
          -webkit-print-color-adjust: exact;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .line { border-top: 1.5px dashed #000; margin: 4px 0; }
        .double-line { border-top: 1.5px double #000; margin: 4px 0; }

        .header-section { margin-bottom: 8px; }
        .header-title { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          color: #000 !important;
        }

        .totals-table td { padding: 1px 0; font-weight: 900; }
        .totals-label { text-align: right; padding-right: 8px; font-weight: 900; }
        .col-right { text-align: right; }

        .footer { margin-top: 10px; font-size: 11px; font-weight: 700; }

        b, strong { font-weight: 900 !important; }
      </style>
    </head>

    <body>
      <div class="header-section center">
        <div class="header-title">TELAS EMANUEL</div>
        <div style="font-weight: 700;">AV. JOSÉ LÓPEZ PORTILLO SM 94</div>
        <div style="font-weight: 700;">MZA 101, LT 11, CANCUN, Q. ROO</div>
        <div style="font-weight: 700;">C.P. 77517 RFC LOGS851027BL5</div>
        <div style="font-weight: 700;">Tel: 998 702 2579</div>
        <br/>
      </div>

      <div class="line"></div>

      <div style="font-weight: 700;">Fecha: ${fechaFormateada}</div>
      <div style="font-weight: 900; font-size: 14px; text-align: center; margin: 8px 0;">
        *** CORTE DE CAJA ***
      </div>
      <div style="font-weight: 700;">Periodo: ${displayDate.value}</div>

      <div class="double-line"></div>

      <table class="totals-table">
        <colgroup>
          <col style="width: 60%" />
          <col style="width: 40%" />
        </colgroup>
        <tbody>
          <tr>
            <td class="totals-label">Transacciones:</td>
            <td class="col-right">${ventas.value.length}</td>
          </tr>
        </tbody>
      </table>

      <div class="line"></div>
      <div style="font-weight: 900; text-align: center; margin: 6px 0;">DESGLOSE POR MÉTODO</div>
      <div class="line"></div>

      <table class="totals-table">
        <colgroup>
          <col style="width: 60%" />
          <col style="width: 40%" />
        </colgroup>
        <tbody>
          <tr>
            <td class="totals-label">Efectivo:</td>
            <td class="col-right">${formatMoney(stats.value.efectivo)}</td>
          </tr>
          <tr>
            <td class="totals-label">Tarjeta:</td>
            <td class="col-right">${formatMoney(stats.value.tarjeta)}</td>
          </tr>
          <tr>
            <td class="totals-label">Transferencia:</td>
            <td class="col-right">${formatMoney(stats.value.transferencia)}</td>
          </tr>
          <tr>
            <td class="totals-label">Dólares (USD):</td>
            <td class="col-right">${formatNumber(stats.value.usd)}</td>
          </tr>
        </tbody>
      </table>

      <div class="double-line"></div>

      <table class="totals-table">
        <colgroup>
          <col style="width: 60%" />
          <col style="width: 40%" />
        </colgroup>
        <tbody>
          <tr style="font-weight:bold">
            <td class="totals-label">INGRESO TOTAL:</td>
            <td class="col-right">${formatMoney(stats.value.granTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <br/>
        <div class="center">
          <div>Este es un reporte interno</div>
          <div>=== Gracias ===</div>
        </div>
      </div>
      <br><br>
    </body>
  </html>
  `;
};

const printDailyReport = async () => {
  try {
    const html = generateDailyReportHTML();
    if (window.pos?.printTicket) {
      await window.pos.printTicket(html);
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
      return;
    }
  } catch (error) {
    console.error('Error imprimiendo reporte del día:', error);
  }
};

watch(dateRange, () => {
  void loadVentas();
});

onMounted(() => {
  void loadVentas();
  void loadProductos();
});

</script>

<template>
  <q-page class="corte-page q-pa-md">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-lg header-section">
      <div>
        <h1 class="text-h4 text-weight-bolder text-grey-9 q-my-none">Corte de Caja</h1>
        <div class="row items-center q-mt-sm">
          <div class="text-subtitle1 text-grey-7 q-mr-md">
            Periodo: <span class="text-weight-bold text-primary">{{ displayDate }}</span>
          </div>
          <q-btn icon="event" round flat color="primary" dense>
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-date v-model="dateRange" range mask="YYYY/MM/DD">
                <div class="row items-center justify-end q-gutter-sm">
                  <q-btn label="Cerrar" color="primary" flat v-close-popup />
                </div>
              </q-date>
            </q-popup-proxy>
          </q-btn>
        </div>
      </div>
      <div class="row q-gutter-sm">
        <q-btn icon="print" flat round color="orange-8" @click="printDailyReport">
          <q-tooltip>Imprimir Reporte</q-tooltip>
        </q-btn>
        <q-btn icon="print" flat round color="primary" @click="printLastReceipt" :disable="!lastReceipt">
          <q-tooltip>Imprimir Último Recibo</q-tooltip>
        </q-btn>
        <q-btn icon="refresh" flat round color="primary" @click="loadVentas" :loading="loading">
          <q-tooltip>Actualizar Datos</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Main KPI Cards -->
    <div class="row q-col-gutter-md q-mb-md">
      <!-- Total Income Card -->
      <div class="col-12 col-md-6">
        <div class="kpi-card gradient-bg text-white">
          <div class="kpi-icon">
            <q-icon name="payments" size="2.5rem" />
          </div>
          <div class="kpi-content">
            <div class="kpi-label">Ingreso Total</div>
            <div class="kpi-value">{{ formatCurrency(stats.granTotal) }}</div>
          </div>
        </div>
      </div>

      <!-- Transaction Count Card -->
      <div class="col-12 col-md-6">
        <div class="kpi-card bg-white text-grey-9 border-gradient">
          <div class="kpi-icon text-orange-8">
            <q-icon name="receipt_long" size="2.5rem" />
          </div>
          <div class="kpi-content">
            <div class="kpi-label text-grey-6">Transacciones</div>
            <div class="kpi-value">{{ ventas.length }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Methods Breakdown Row -->
    <div class="row q-col-gutter-sm q-mb-xl">
      <div class="col-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-green-8">
            <q-icon name="attach_money" /> Efectivo
          </div>
          <div class="stat-amount">{{ formatCurrency(stats.efectivo) }}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-blue-8">
            <q-icon name="credit_card" /> Tarjeta
          </div>
          <div class="stat-amount">{{ formatCurrency(stats.tarjeta) }}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-purple-8">
            <q-icon name="account_balance" /> Transferencia
          </div>
          <div class="stat-amount">{{ formatCurrency(stats.transferencia) }}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-teal-8">
            <q-icon name="local_atm" /> Dólares
          </div>
          <div class="stat-amount">USD {{ formatNumber(stats.usd) }}</div>
        </div>
      </div>
    </div>

    <!-- Sales List -->
    <div class="sales-section">
      <h2 class="text-h5 text-weight-bold q-mb-md text-grey-8">Movimientos del Periodo</h2>

      <div v-if="loading" class="row justify-center q-py-lg">
        <q-spinner-dots size="3rem" color="primary" />
      </div>

      <div v-else-if="ventas.length === 0" class="empty-state text-center q-py-xl">
        <q-icon name="point_of_sale" size="4rem" color="grey-4" />
        <p class="text-grey-5 q-mt-md text-h6">No se registraron movimientos en este periodo.</p>
      </div>

      <q-list v-else separator class="sales-list bg-white shadow-1 rounded-borders">
        <q-expansion-item v-for="venta in ventas" :key="venta.id" group="sales" class="sale-item"
          expand-icon-class="hidden">
          <template v-slot:header="{ expanded }">
            <div class="row full-width items-center q-py-xs">
              <div class="col-auto q-mr-md">
                <div class="time-badge">{{ formatTime(venta.fecha_venta) }}</div>
                <div class="text-caption text-grey-5 q-mt-xs">{{ formatDateLong(venta.fecha_venta) }}</div>
              </div>
              <div class="col">
                <div class="text-weight-bold text-grey-9">{{ venta.cliente || 'Cliente General' }}</div>
                <div class="text-caption text-grey-6">
                  <q-icon name="payments" size="xs" /> {{ venta.metodo_pago }}
                  <span v-if="venta.comentarios" class="q-ml-sm text-italic">"{{ venta.comentarios }}"</span>
                </div>
              </div>
              <div class="col-auto text-right row items-center q-gutter-x-sm">
                <q-btn icon="print" flat round dense color="primary" @click.stop="printVenta(venta)">
                  <q-tooltip>Imprimir esta venta</q-tooltip>
                </q-btn>
                <div>
                  <div class="text-weight-bolder text-primary text-body1">{{ formatCurrency(venta.total) }}</div>
                  <div class="text-caption text-grey-5">#{{ venta.id }}</div>
                </div>
                <q-icon :name="expanded ? 'expand_less' : 'expand_more'" size="sm" color="grey-6" />
              </div>
            </div>
          </template>

          <q-card>
            <q-card-section class="bg-grey-1 q-px-md q-py-sm">
              <div class="text-caption text-weight-bold text-grey-7 q-mb-xs">PRODUCTOS VENDIDOS:</div>
              <div v-for="detalle in venta.detallesVenta" :key="detalle.id"
                class="row justify-between q-mb-xs text-body2">
                <div>
                  <span class="text-weight-bold">{{ formatNumber(detalle.cantidad) }}</span>
                  {{ detalle.medida || getProductoMedida(detalle.producto_id) }} x {{
                    getProductoNombre(detalle.producto_id) }}
                </div>
                <div class="text-grey-7">
                  {{ formatCurrency((detalle.precio_unitario || 0) * (detalle.cantidad || 0)) }}
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>
    </div>

    <!-- Receipt Printer Component (hidden, only for printing) -->
    <ReceiptPrinter ref="receiptPrinter" :data="lastReceipt" />
  </q-page>
</template>

<style scoped>
.corte-page {
  background-color: #f8fafc;
  min-height: 100vh;
}

/* Premium Gradient Utilities */
.gradient-bg {
  background: linear-gradient(135deg, #FFD54F 0%, #8B5E3C 100%);
}

.text-primary {
  color: #8B5E3C !important;
}

.border-gradient {
  position: relative;
  overflow: hidden;
}

.border-gradient::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(to bottom, #FFD54F, #8B5E3C);
}

/* KPI Cards */
.kpi-card {
  padding: 1.5rem;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 1.5rem;
  height: 100%;
  transition: transform 0.2s;
}

.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
}

.kpi-icon {
  padding: 10px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.border-gradient .kpi-icon {
  background: #fff3e0;
}

.kpi-content {
  flex: 1;
}

.kpi-label {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
  opacity: 0.9;
}

.kpi-value {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.2;
}

/* Sales List */
.sales-list {
  border-radius: 16px;
  overflow: hidden;
}

.sale-item:hover {
  background-color: #fcfcfc;
}

.time-badge {
  background: #f1f5f9;
  color: #64748b;
  font-weight: 600;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 6px;
}

.mini-stat-card {
  background: white;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  text-align: center;
  border: 1px solid #f0f0f0;
  transition: all 0.2s;
}

.mini-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.06);
  border-color: #e0e0e0;
}

.stat-label {
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.stat-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
}

.hidden {
  display: none !important;
}
</style>
