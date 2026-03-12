<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import api from 'src/api/axios';
import { useQuasar, date } from 'quasar';
import ReceiptPrinter from 'src/components/ReceiptPrinter.vue';
import type { ReceiptData } from 'src/components/types';
import * as XLSX from 'xlsx';
import { useAuthStore } from 'src/stores/auth';
// Interfaces based on API introspection
interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre?: string;
}

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
  usuario_id?: number | null;
  usuario_username?: string | null;
  usuario?: Usuario;
  requiere_factura?: boolean;
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
const authStore = useAuthStore();
const datos = ref<{ email?: string } | null>(null);
const usuarios = ref<Usuario[]>([]);
const usuarioSeleccionado = ref<number | null>(null);
const stats = ref({
  efectivo: 0,
  tarjeta: 0,
  transferencia: 0,
  usd: 0,
  granTotal: 0
});

// Calcular stats con débito y crédito separados
const statsCalculadas = computed(() => {
  let efectivo = 0;
  let debito = 0;
  let credito = 0;
  let transferencia = 0;
  let mixto = 0;
  let usd = 0;

  ventas.value.forEach(venta => {
    const metodoPago = (venta.metodo_pago || 'EFECTIVO').toUpperCase();
    const comentarios = venta.comentarios || '';
    const total = Number(venta.total) || 0;

    if (metodoPago === 'EFECTIVO') {
      efectivo += total;
    } else if (metodoPago === 'DEBITO') {
      debito += total;
    } else if (metodoPago === 'CREDITO') {
      credito += total;
    } else if (metodoPago === 'TARJETA') {
      // Verificar en comentarios si es débito o crédito
      if (comentarios.includes('[Tipo Tarjeta: DEBITO]')) {
        debito += total;
      } else if (comentarios.includes('[Tipo Tarjeta: CREDITO]')) {
        credito += total;
      } else {
        // Si no se especifica, asumir que es tarjeta genérica (débito por defecto)
        debito += total;
      }
    } else if (metodoPago === 'TRANSFERENCIA') {
      transferencia += total;
    } else if (metodoPago === 'MIXTO') {
      // Pago mixto (múltiples métodos)
      mixto += total;
    }

    // Extraer USD de los comentarios si existen
    const usdMatch = comentarios.match(/USD:\s*([\d.]+)/i);
    if (usdMatch && usdMatch[1]) {
      usd += parseFloat(usdMatch[1]);
    }
  });

  return {
    efectivo,
    debito,
    credito,
    tarjeta: debito + credito, // Total de tarjetas
    transferencia,
    mixto,
    usd,
    granTotal: efectivo + debito + credito + transferencia + mixto
  };
});
const loading = ref(true);
const productosMap = ref<Map<number, string>>(new Map());
const medidasMap = ref<Map<number, string>>(new Map());
const receiptPrinter = ref<InstanceType<typeof ReceiptPrinter> | null>(null);
const lastReceipt = ref<ReceiptData | null>(null);

// Date selection
const todayFormatted = date.formatDate(Date.now(), 'DD/MM/YYYY');
const dateRange = ref<string>(todayFormatted);

const displayDate = computed(() => {
  return dateRange.value;
});

const displayUsuario = computed(() => {
  if (usuarioSeleccionado.value === null) {
    return 'Todos los usuarios';
  }
  const usuario = usuarios.value.find(u => u.id === usuarioSeleccionado.value);
  return usuario?.username || usuario?.nombre || usuario?.email || 'Usuario desconocido';
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

  // Intentar obtener el nombre del usuario que hizo la venta
  let atendidoPor = 'MOSTRADOR';

  try {
    // Primero intentar del campo usuario_username que viene de la BD
    if (venta.usuario_username) {
      atendidoPor = venta.usuario_username;
    }
    // Si no, intentar del usuario relacionado
    else if (venta.usuario?.username) {
      atendidoPor = venta.usuario.username;
    }
    // Luego intentar del authStore actual
    else if (authStore.user?.username) {
      atendidoPor = authStore.user.username;
    }
    // Finalmente fallback a sessionStorage
    else {
      const authUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
      if (authUser?.username) {
        atendidoPor = authUser.username;
      }
    }
  } catch {
    // Si hay error, seguir con fallback
  }

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
    atendidoPor,
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
    // Convertir de DD/MM/YYYY a YYYY-MM-DD
    const [day, month, year] = (dateRange.value || todayFormatted).split('/');
    const inicio = `${year}-${month}-${day}`;
    const fin = inicio; // Mismo día

    const params: { inicio: string; fin: string; usuario_id?: number; _t?: number } = {
      inicio,
      fin,
      _t: Date.now() // Cache busting - prevenir respuestas 304
    };
    if (usuarioSeleccionado.value !== null) {
      params.usuario_id = usuarioSeleccionado.value;
    }

    console.log('🔍 DEBUG CortePage - Parámetros de búsqueda:', params);

    const { data } = await api.get<CorteResponse>('ventas/rango', { params });

    console.log('📊 DEBUG CortePage - Respuesta del API:', data);
    console.log('📊 DEBUG CortePage - Ventas recibidas:', data.ventas);
    console.log('📊 DEBUG CortePage - Stats:', data.stats);

    // Filtrar ventas para mostrar solo las del día seleccionado (convertir a zona horaria local)
    const ventasFiltradas = data.ventas.filter(venta => {
      // Convertir fecha ISO a zona horaria local
      const fechaLocal = date.formatDate(new Date(venta.fecha_venta), 'YYYY-MM-DD');
      return fechaLocal === inicio;
    });

    console.log(`📊 Ventas filtradas para ${inicio}:`, ventasFiltradas);

    ventas.value = ventasFiltradas;
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

const loadUsuarios = async () => {
  try {
    const res = await api.get('usuarios');
    const data = Array.isArray(res.data) ? res.data : (res.data.usuarios ?? []);
    usuarios.value = data.map((u: Record<string, unknown>) => ({
      id: (u.id ?? u.Id) as number,
      username: (u.username ?? u.Username) as string,
      email: (u.email ?? u.Email) as string,
      nombre: (u.nombre ?? u.Nombre) as string
    }));

    console.log('✅ Usuarios cargados:', usuarios.value);

    // No filtrar automáticamente - mostrar todas las ventas por defecto
    // El usuario puede filtrar manualmente si lo desea
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
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
      ${usuarioSeleccionado.value !== null ? `
      <div style="font-weight: 700;">Usuario: ${usuarios.value.find(u => u.id === usuarioSeleccionado.value)?.username || 'N/A'}</div>
      ` : '<div style="font-weight: 700;">Usuario: TODOS</div>'}

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
            <td class="col-right">${formatMoney(statsCalculadas.value.efectivo)}</td>
          </tr>
          <tr>
            <td class="totals-label">Débito:</td>
            <td class="col-right">${formatMoney(statsCalculadas.value.debito)}</td>
          </tr>
          <tr>
            <td class="totals-label">Crédito:</td>
            <td class="col-right">${formatMoney(statsCalculadas.value.credito)}</td>
          </tr>
          <tr>
            <td class="totals-label">Transferencia:</td>
            <td class="col-right">${formatMoney(statsCalculadas.value.transferencia)}</td>
          </tr>
          <tr>
            <td class="totals-label">Dólares (USD):</td>
            <td class="col-right">${formatNumber(statsCalculadas.value.usd)}</td>
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
            <td class="col-right">${formatMoney(statsCalculadas.value.granTotal)}</td>
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

const exportToExcel = () => {
  try {
    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Preparar datos del resumen
    const resumenData = [
      ['TELAS EMANUEL - REPORTE DE VENTAS'],
      [''],
      ['Periodo:', displayDate.value],
      ['Usuario:', displayUsuario.value],
      ['Fecha de Generación:', date.formatDate(Date.now(), 'DD/MM/YYYY HH:mm')],
      [''],
      ['RESUMEN POR TIPO DE PAGO'],
      ['Efectivo:', formatCurrency(statsCalculadas.value.efectivo)],
      ['Débito:', formatCurrency(statsCalculadas.value.debito)],
      ['Crédito:', formatCurrency(statsCalculadas.value.credito)],
      ['Transferencia:', formatCurrency(statsCalculadas.value.transferencia)],
      ['Dólares (USD):', formatNumber(statsCalculadas.value.usd)],
      [''],
      ['TOTAL GENERAL:', formatCurrency(statsCalculadas.value.granTotal)],
      ['Total de Transacciones:', ventas.value.length],
      filtroTipoPago.value ? ['Filtro Aplicado:', filtroTipoPago.value] : [],
      filtroTipoPago.value ? ['Transacciones Filtradas:', ventasFiltradas.value.length] : [],
      ['']
    ].filter(row => row.length > 0);

    // Preparar datos de ventas
    const ventasData: (string | number)[][] = [
      ['DETALLE DE VENTAS'],
      [''],
      ['ID', 'Fecha', 'Hora', 'Cliente', 'Usuario', 'Método de Pago', 'Total', 'Comentarios']
    ];

    ventasFiltradas.value.forEach(venta => {
      ventasData.push([
        venta.id,
        formatDateLong(venta.fecha_venta),
        formatTime(venta.fecha_venta),
        venta.cliente || 'Cliente General',
        venta.usuario?.username || venta.usuario?.nombre || venta.usuario?.email || 'N/A',
        venta.metodo_pago,
        Number(venta.total) || 0,
        venta.comentarios || ''
      ]);
    });

    // Preparar datos de productos vendidos
    const productosData: (string | number)[][] = [
      ['DETALLE DE PRODUCTOS'],
      [''],
      ['Venta ID', 'Cliente', 'Usuario', 'Producto', 'Cantidad', 'Medida', 'Precio Unitario', 'Subtotal']
    ];
    //TODO:
    ventasFiltradas.value.forEach(venta => {
      (venta.detallesVenta || []).forEach(detalle => {
        const cantidad = Number(detalle.cantidad) || 0;
        const precioUnitario = Number(detalle.precio_unitario) || 0;
        const subtotal = cantidad * precioUnitario;
        productosData.push([
          venta.id,
          venta.cliente || 'Cliente General',
          venta.usuario?.username || venta.usuario?.nombre || venta.usuario?.email || 'N/A',
          getProductoNombre(detalle.producto_id),
          cantidad,
          detalle.medida || getProductoMedida(detalle.producto_id),
          precioUnitario,
          subtotal
        ]);
      });
    });

    // Crear hojas
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    const wsVentas = XLSX.utils.aoa_to_sheet(ventasData);
    const wsProductos = XLSX.utils.aoa_to_sheet(productosData);

    // Ajustar anchos de columnas
    wsResumen['!cols'] = [{ wch: 25 }, { wch: 20 }];
    wsVentas['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
    wsProductos['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];

    // Agregar hojas al workbook
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');
    XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos');

    // Generar nombre de archivo
    const fileName = `Reporte_Ventas_${date.formatDate(Date.now(), 'YYYYMMDD_HHmmss')}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, fileName);

    $q.notify({
      message: 'Reporte de Excel generado exitosamente',
      color: 'positive',
      icon: 'download'
    });
  } catch (error) {
    console.error('Error generando reporte de Excel:', error);
    $q.notify({
      message: 'Error al generar el reporte de Excel',
      color: 'negative',
      icon: 'error'
    });
  }
};

// Filtro de tipo de pago
const filtroTipoPago = ref<string | null>(null);

// Filtro de estado de factura
const filtroFactura = ref<boolean | null>(null);

// Helper para obtener el tipo de tarjeta de una venta
const getTipoTarjeta = (venta: Venta): 'DEBITO' | 'CREDITO' | null => {
  const metodoPago = (venta.metodo_pago || '').toUpperCase();
  const comentarios = venta.comentarios || '';

  if (metodoPago !== 'TARJETA' && !(metodoPago === 'MIXTO' && comentarios.includes('[Tipo Tarjeta:'))) {
    return null;
  }

  if (comentarios.includes('[Tipo Tarjeta: CREDITO]')) {
    return 'CREDITO';
  }

  if (comentarios.includes('[Tipo Tarjeta: DEBITO]')) {
    return 'DEBITO';
  }

  // Por defecto, si es tarjeta sin especificar, asumir débito
  return 'DEBITO';
};

// Separar ventas de tarjeta en débito y crédito
const ventasTarjetaDebito = computed(() => {
  if (filtroTipoPago.value !== 'TARJETA') return [];
  return ventas.value.filter(venta => {
    const metodoPago = (venta.metodo_pago || '').toUpperCase();
    if (metodoPago !== 'TARJETA' && metodoPago !== 'MIXTO') return false;
    return getTipoTarjeta(venta) === 'DEBITO';
  });
});

const ventasTarjetaCredito = computed(() => {
  if (filtroTipoPago.value !== 'TARJETA') return [];
  return ventas.value.filter(venta => {
    const metodoPago = (venta.metodo_pago || '').toUpperCase();
    if (metodoPago !== 'TARJETA' && metodoPago !== 'MIXTO') return false;
    return getTipoTarjeta(venta) === 'CREDITO';
  });
});

const ventasFiltradas = computed(() => {
  let resultado = ventas.value;

  // Aplicar filtro de tipo de pago
  if (filtroTipoPago.value) {
    if (filtroTipoPago.value === 'TARJETA') {
      resultado = resultado.filter(venta => {
        const metodoPago = (venta.metodo_pago || 'EFECTIVO').toUpperCase();
        return metodoPago === 'TARJETA' || metodoPago === 'MIXTO';
      });
    } else {
      resultado = resultado.filter(venta => {
        const metodoPago = (venta.metodo_pago || 'EFECTIVO').toUpperCase();
        return metodoPago === filtroTipoPago.value?.toUpperCase();
      });
    }
  }

  // Aplicar filtro de factura
  if (filtroFactura.value !== null) {
    resultado = resultado.filter(venta => venta.requiere_factura === filtroFactura.value);
  }

  return resultado;
});

// Calcular total de ventas sin factura
const totalVentasSinFactura = computed(() => {
  return ventas.value
    .filter(v => !v.requiere_factura)
    .reduce((sum, v) => sum + (Number(v.total) || 0), 0);
});

// Calcular total de ventas con factura (requieren factura)
const totalVentasConFactura = computed(() => {
  return ventas.value
    .filter(v => v.requiere_factura)
    .reduce((sum, v) => sum + (Number(v.total) || 0), 0);
});

// Contadores de ventas por método de pago
const ventasFiltradasPorMetodo = computed(() => {
  let contEfectivo = 0;
  let contTarjeta = 0;
  let contTransferencia = 0;
  let contMixto = 0;
  let contUSD = 0;

  ventasFiltradas.value.forEach(venta => {
    const metodoPago = (venta.metodo_pago || 'EFECTIVO').toUpperCase();
    const comentarios = venta.comentarios || '';

    if (metodoPago === 'EFECTIVO') {
      contEfectivo++;
    } else if (metodoPago === 'TARJETA' || metodoPago === 'DEBITO' || metodoPago === 'CREDITO') {
      contTarjeta++;
    } else if (metodoPago === 'TRANSFERENCIA') {
      contTransferencia++;
    } else if (metodoPago === 'MIXTO') {
      contMixto++;
    }

    const usdMatch = comentarios.match(/USD:\s*([\d.]+)/i);
    if (usdMatch && usdMatch[1]) {
      contUSD++;
    }
  });

  return {
    efectivo: contEfectivo,
    tarjeta: contTarjeta,
    transferencia: contTransferencia,
    mixto: contMixto,
    usd: contUSD
  };
});

// Contadores de ventas filtradas por estado de factura
const ventasFiltradasPorFactura = computed(() => {
  const sinFactura = ventasFiltradas.value.filter(v => !v.requiere_factura).length;
  const conFactura = ventasFiltradas.value.filter(v => v.requiere_factura).length;

  return {
    sinFactura,
    conFactura
  };
});

const toggleFiltroTipoPago = (tipo: string) => {
  if (filtroTipoPago.value === tipo.toUpperCase()) {
    filtroTipoPago.value = null; // Deseleccionar si ya está seleccionado
  } else {
    filtroTipoPago.value = tipo.toUpperCase();
  }
};

const toggleFiltroFactura = (requiereFactura: boolean) => {
  if (filtroFactura.value === requiereFactura) {
    filtroFactura.value = null; // Deseleccionar si ya está seleccionado
  } else {
    filtroFactura.value = requiereFactura;
  }
};

watch(dateRange, () => {
  void loadVentas();
  filtroTipoPago.value = null; // Limpiar filtro al cambiar fecha
  filtroFactura.value = null;
});

watch(usuarioSeleccionado, () => {
  filtroTipoPago.value = null; // Limpiar filtro al cambiar usuario
  filtroFactura.value = null;
  void loadVentas();
});

onMounted(async () => {
  datos.value = authStore.user as { email: string };
  filtroTipoPago.value = null;
  filtroFactura.value = null;
  await loadUsuarios();
  void loadVentas();
  void loadProductos();
});

</script>

<template>
  <q-page class="corte-page q-pa-md">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-lg header-section">
      <div>
        <h1 class="text-h4 text-weight-bolder text-grey-9 q-my-none">Corte de caja</h1>
        <div class="row items-center q-mt-sm">
          <div class="text-subtitle1 text-grey-7 q-mr-md">
            Periodo: <span class="text-weight-bold text-primary">{{ displayDate }}</span>
          </div>
          <q-btn icon="event" round flat color="primary" dense>
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-date v-model="dateRange" mask="DD/MM/YYYY">
                <div class="row items-center justify-end q-gutter-sm">
                  <q-btn label="Cerrar" color="primary" flat v-close-popup />
                </div>
              </q-date>
            </q-popup-proxy>
          </q-btn>
        </div>
        <!--<div class="row items-center q-mt-sm">
          <div class="text-subtitle2 text-grey-7 q-mr-md">Usuario:</div>
          <q-select v-model="usuarioSeleccionado"
            :options="[{ label: 'Todos los usuarios', value: null }, ...usuarios.map(u => ({ label: u.username || u.email, value: u.id }))]"
            outlined dense emit-value map-options style="min-width: 200px" class="q-mr-md">
            <template v-slot:prepend>
              <q-icon name="person" />
            </template>
</q-select>
</div>-->
      </div>
      <div class="row q-gutter-sm">
        <q-btn icon="description" flat round color="green-8" @click="exportToExcel">
          <q-tooltip>Exportar a Excel</q-tooltip>
        </q-btn>
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
            <div class="kpi-value">{{ formatCurrency(statsCalculadas.granTotal) }}</div>
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
        <div class="mini-stat-card" :class="{ 'active-filter': filtroTipoPago === 'EFECTIVO' }"
          @click="toggleFiltroTipoPago('EFECTIVO')">
          <div class="stat-label text-green-8">
            <q-icon name="attach_money" /> Efectivo
          </div>
          <div class="stat-amount">{{ formatCurrency(statsCalculadas.efectivo) }}</div>
          <div class="stat-breakdown">{{ ventasFiltradasPorMetodo.efectivo }} venta{{ ventasFiltradasPorMetodo.efectivo
            !==
            1 ? 's' : '' }}</div>
          <q-tooltip>Click para filtrar ventas en efectivo</q-tooltip>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card" :class="{ 'active-filter': filtroTipoPago === 'TARJETA' }"
          @click="toggleFiltroTipoPago('TARJETA')">
          <div class="stat-label text-blue-8">
            <q-icon name="credit_card" /> Tarjeta
          </div>
          <div class="stat-amount">{{ formatCurrency(statsCalculadas.tarjeta) }}</div>
          <div class="stat-breakdown">{{ ventasFiltradasPorMetodo.tarjeta }} venta{{ ventasFiltradasPorMetodo.tarjeta
            !== 1
            ? 's' : '' }}</div>
          <q-tooltip>Click para ver ventas con tarjeta (débito/crédito)</q-tooltip>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card" :class="{ 'active-filter': filtroTipoPago === 'TRANSFERENCIA' }"
          @click="toggleFiltroTipoPago('TRANSFERENCIA')">
          <div class="stat-label text-purple-8">
            <q-icon name="account_balance" /> Transferencia
          </div>
          <div class="stat-amount">{{ formatCurrency(statsCalculadas.transferencia) }}</div>
          <div class="stat-breakdown">{{ ventasFiltradasPorMetodo.transferencia }} venta{{
            ventasFiltradasPorMetodo.transferencia !== 1 ? 's' : '' }}</div>
          <q-tooltip>Click para filtrar ventas por transferencia</q-tooltip>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card" :class="{ 'active-filter': filtroTipoPago === 'MIXTO' }"
          @click="toggleFiltroTipoPago('MIXTO')">
          <div class="stat-label text-indigo-8">
            <q-icon name="shuffle" /> Mixto
          </div>
          <div class="stat-amount">{{ formatCurrency(statsCalculadas.mixto) }}</div>
          <div class="stat-breakdown">{{ ventasFiltradasPorMetodo.mixto }} venta{{ ventasFiltradasPorMetodo.mixto !== 1
            ?
            's' : '' }}</div>
          <q-tooltip>Click para filtrar ventas con pago mixto</q-tooltip>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-teal-8">
            <q-icon name="local_atm" /> Dólares
          </div>
          <div class="stat-amount">USD {{ formatNumber(statsCalculadas.usd) }}</div>
          <div class="stat-breakdown">{{ ventasFiltradasPorMetodo.usd }} venta{{ ventasFiltradasPorMetodo.usd !== 1 ?
            's' :
            '' }}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card" :class="{ 'active-filter': filtroFactura === false }"
          @click="toggleFiltroFactura(false)">
          <div class="stat-label text-orange-8">
            <q-icon name="receipt" /> Ventas sin factura
          </div>
          <div class="stat-amount">{{ formatCurrency(totalVentasSinFactura) }}</div>
          <div class="stat-breakdown">{{ ventasFiltradasPorFactura.sinFactura }} venta{{
            ventasFiltradasPorFactura.sinFactura !== 1 ? 's' : '' }}</div>
          <q-tooltip>Click para mostrar solo ventas facturadas</q-tooltip>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="mini-stat-card" :class="{ 'active-filter': filtroFactura === true }"
          @click="toggleFiltroFactura(true)">
          <div class="stat-label text-red-8">
            <q-icon name="receipt_long" /> Ventas con factura
          </div>
          <div class="stat-amount">{{ formatCurrency(totalVentasConFactura) }}</div>
          <div class="stat-breakdown">{{ ventasFiltradasPorFactura.conFactura }} venta{{
            ventasFiltradasPorFactura.conFactura !== 1 ? 's' : '' }}</div>
          <q-tooltip>Click para mostrar solo ventas pendientes de factura</q-tooltip>
        </div>
      </div>
    </div>

    <!-- Invoicing Status Filter Row -->
    <!-- <div class="row q-col-gutter-sm q-mb-xl">
      <div class="col-12">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">Filtrar por estado de facturación:</div>
      </div>

    </div> -->
    <div class="sales-section">
      <h2 class="text-h5 text-weight-bold q-mb-md text-grey-8">Movimientos del Periodo</h2>

      <div v-if="loading" class="row justify-center q-py-lg">
        <q-spinner-dots size="3rem" color="primary" />
      </div>

      <div v-else-if="ventasFiltradas.length === 0" class="empty-state text-center q-py-xl">
        <q-icon name="point_of_sale" size="4rem" color="grey-4" />
        <p class="text-grey-5 q-mt-md text-h6">
          {{ filtroTipoPago ? `Este es el apartado de las ventas pagadas con ${filtroTipoPago.toLowerCase()}` : 'No hay ventas registradas' }}
        </p>
      </div>

      <!-- Vista de dos columnas cuando se filtra por TARJETA -->
      <div v-else-if="filtroTipoPago === 'TARJETA'" class="tarjeta-split-view">
        <div class="tarjeta-column">
          <h3 class="column-title debito-title">
            <q-icon name="credit_card" /> Débito ({{ ventasTarjetaDebito.length }})
          </h3>
          <q-list v-if="ventasTarjetaDebito.length > 0" separator class="sales-list bg-white shadow-1 rounded-borders">
            <q-expansion-item v-for="venta in ventasTarjetaDebito" :key="venta.id" group="sales-debito"
              class="sale-item" expand-icon-class="hidden">
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
                    </div>
                    <div v-if="venta.usuario_username || venta.usuario" class="text-caption text-grey-6">
                      <q-icon name="person" size="xs" /> Atendió: {{ venta.usuario_username || venta.usuario?.username
                        || venta.usuario?.email }}
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
                <q-card-section>
                  <div class="text-h6">Detalle de productos</div>
                  <q-list dense separator>
                    <q-item v-for="(detalle, idx) in venta.detallesVenta" :key="idx">
                      <q-item-section>
                        <q-item-label>{{ getProductoNombre(detalle.producto_id) }}</q-item-label>
                        <q-item-label caption>
                          {{ detalle.cantidad }} {{ detalle.medida || getProductoMedida(detalle.producto_id) }} × {{
                            formatCurrency(detalle.precio_unitario) }}
                        </q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-item-label>{{ formatCurrency(detalle.cantidad * detalle.precio_unitario) }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>
              </q-card>
            </q-expansion-item>
          </q-list>
          <div v-else class="empty-column">
            <q-icon name="credit_card_off" size="3rem" color="grey-4" />
            <p class="text-grey-5">No hay ventas con débito</p>
          </div>
        </div>

        <div class="tarjeta-column">
          <h3 class="column-title credito-title">
            <q-icon name="credit_card" /> Crédito ({{ ventasTarjetaCredito.length }})
          </h3>
          <q-list v-if="ventasTarjetaCredito.length > 0" separator class="sales-list bg-white shadow-1 rounded-borders">
            <q-expansion-item v-for="venta in ventasTarjetaCredito" :key="venta.id" group="sales-credito"
              class="sale-item" expand-icon-class="hidden">
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
                    </div>
                    <div v-if="venta.usuario_username || venta.usuario" class="text-caption text-grey-6">
                      <q-icon name="person" size="xs" /> Atendió: {{ venta.usuario_username || venta.usuario?.username
                        || venta.usuario?.email }}
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
                <q-card-section>
                  <div class="text-h6">Detalle de productos</div>
                  <q-list dense separator>
                    <q-item v-for="(detalle, idx) in venta.detallesVenta" :key="idx">
                      <q-item-section>
                        <q-item-label>{{ getProductoNombre(detalle.producto_id) }}</q-item-label>
                        <q-item-label caption>
                          {{ detalle.cantidad }} {{ detalle.medida || getProductoMedida(detalle.producto_id) }} × {{
                            formatCurrency(detalle.precio_unitario) }}
                        </q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-item-label>{{ formatCurrency(detalle.cantidad * detalle.precio_unitario) }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>
              </q-card>
            </q-expansion-item>
          </q-list>
          <div v-else class="empty-column">
            <q-icon name="credit_card_off" size="3rem" color="grey-4" />
            <p class="text-grey-5">No hay ventas con crédito</p>
          </div>
        </div>
      </div>

      <!-- Vista normal para otros métodos de pago -->
      <q-list v-else separator class="sales-list bg-white shadow-1 rounded-borders">
        <q-expansion-item v-for="venta in ventasFiltradas" :key="venta.id" group="sales" class="sale-item"
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
                <div v-if="venta.usuario_username || venta.usuario" class="text-caption text-grey-6">
                  <q-icon name="person" size="xs" /> Atendió: {{ venta.usuario_username || venta.usuario?.username ||
                    venta.usuario?.email }}
                </div>
              </div>
              <div class="col-auto text-right row items-center q-gutter-x-sm">
                <q-btn icon="print" flat round dense color="primary" @click.stop="printVenta(venta)">
                  <q-tooltip>Imprimir esta venta</q-tooltip>
                </q-btn>
                <div>
                  <div class="text-weight-bolder text-primary text-body1">{{
                    formatCurrency(venta.total) }}</div>
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
  cursor: pointer;
  position: relative;
}

.mini-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.06);
  border-color: #e0e0e0;
}

.mini-stat-card.active-filter {
  background: linear-gradient(135deg, #d9a441 0%, #8b5e3c 100%);
  border-color: #d9a441;
  box-shadow: 0 4px 20px rgba(217, 164, 65, 0.4);
  transform: translateY(-2px) scale(1.02);
}

.mini-stat-card.active-filter .stat-label,
.mini-stat-card.active-filter .stat-amount {
  color: white !important;
}

.mini-stat-card.active-filter::after {
  content: '✓';
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.3);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
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

.stat-breakdown {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.25rem;
  font-size: 0.7rem;
  opacity: 0.8;
}

.breakdown-item {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-weight: 600;
}

.mini-stat-card.active-filter .breakdown-item {
  background: rgba(255, 255, 255, 0.3);
  color: white;
}

/* Vista de dos columnas para tarjetas */
.tarjeta-split-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .tarjeta-split-view {
    grid-template-columns: 1fr;
  }
}

.tarjeta-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.column-title {
  font-size: 1.25rem;
  font-weight: 700;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.debito-title {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.credito-title {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.empty-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  background: white;
  border-radius: 12px;
}

.filter-badge {
  display: flex;
  align-items: center;
}

.hidden {
  display: none !important;
}
</style>
