<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import api from '../api/axios';

interface Venta {
  id: number;
  cliente?: string;
  fecha_venta: string;
  total: number;
  metodo_pago?: string;
  comentarios?: string;
  requiere_factura?: boolean;
  detallesVenta: Array<{
    id: number;
    producto_id: number;
    producto?: { nombre: string };
    cantidad: number;
    precio_unitario: number;
  }>;
}

const modo = ref('todas');
const detalleId = ref('');
const fechaInicio = ref('');
const fechaFin = ref('');
const ventas = ref<Venta[]>([])
const cargando = ref(false);
const error = ref('');
const estadisticoProductos = ref<'media' | 'mediana' | 'moda'>('media');
const mostrarAnalisis = ref(true);

const statsCalculadas = computed(() => {
  let efectivo = 0;
  let debito = 0;
  let credito = 0;
  let transferencia = 0;
  let usd = 0;

  ventas.value.forEach(venta => {
    const metodoPago = (venta.metodo_pago || 'EFECTIVO').toUpperCase();
    const comentarios = venta.comentarios || '';
    const total = Number(venta.total) || 0;

    const parseAmount = (regex: RegExp): number => {
      const match = comentarios.match(regex);
      if (match && match[1]) {
        return parseFloat(match[1]);
      }
      return 0;
    };

    if (metodoPago === 'MIXTO' && comentarios.includes('[Detalle Pago:')) {
      const pPesos = parseAmount(/Pesos\s*:?\s*\$?([\d.]+)/);
      const pUSD = parseAmount(/USD:\s*([\d.]+)/);
      const tasaCambio = parseAmount(/\(Tasa:\s*([\d.]+)\)/);
      const pTarjeta = parseAmount(/Tarjeta:\s*\$?([\d.]+)/);
      const pTransf = parseAmount(/Transf\s*:?\s*\$?([\d.]+)/);

      efectivo += pPesos;
      debito += pTarjeta;
      transferencia += pTransf;

      // Mantener registro de USD para referencia
      if (pUSD > 0 && tasaCambio > 0) {
        usd += pUSD;
      }
    } else if (metodoPago === 'EFECTIVO') {
      efectivo += total;
    } else if (metodoPago === 'DEBITO') {
      debito += total;
    } else if (metodoPago === 'CREDITO') {
      credito += total;
    } else if (metodoPago === 'TARJETA') {
      if (comentarios.includes('[Tipo Tarjeta: DEBITO]')) {
        debito += total;
      } else if (comentarios.includes('[Tipo Tarjeta: CREDITO]')) {
        credito += total;
      } else {
        debito += total;
      }
    } else if (metodoPago === 'TRANSFERENCIA') {
      transferencia += total;
    }

    if (metodoPago !== 'MIXTO') {
      const usdMatch = comentarios.match(/USD:\s*([\d.]+)/i);
      if (usdMatch && usdMatch[1]) {
        usd += parseFloat(usdMatch[1]);
      }
    }
  });

  const totalVentasSinFactura = ventas.value
    .filter(v => !v.requiere_factura)
    .reduce((sum, v) => sum + (Number(v.total) || 0), 0);

  const totalVentasConFactura = ventas.value
    .filter(v => v.requiere_factura)
    .reduce((sum, v) => sum + (Number(v.total) || 0), 0);

  return {
    efectivo,
    debito,
    credito,
    tarjeta: debito + credito,
    transferencia,
    usd,
    granTotal: efectivo + debito + credito + transferencia + (usd * 16),
    totalVentasSinFactura,
    totalVentasConFactura
  };
});

// Funciones para calcular estadísticos
const calcularMedia = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
};

const calcularMediana = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const val1 = sorted[mid - 1] ?? 0;
  const val2 = sorted[mid] ?? 0;
  return sorted.length % 2 !== 0 ? val2 : (val1 + val2) / 2;
};

const calcularModa = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  const frecuencia = new Map<number, number>();
  let maxFrecuencia = 0;
  let moda: number = valores[0] ?? 0;

  valores.forEach(val => {
    const count = (frecuencia.get(val) || 0) + 1;
    frecuencia.set(val, count);
    if (count > maxFrecuencia) {
      maxFrecuencia = count;
      moda = val;
    }
  });

  return moda;
};

// Computed para estadísticas por producto
const estadisticasProductos = computed(() => {
  const productosMap = new Map<number, { nombre: string; cantidades: number[] }>();

  // Agrupar cantidades por producto
  ventas.value.forEach(venta => {
    venta.detallesVenta.forEach(detalle => {
      const key = detalle.producto_id;
      const nombre = detalle.producto?.nombre || `Producto #${key}`;
      const cantidad = Number(detalle.cantidad) || 0;

      if (!productosMap.has(key)) {
        productosMap.set(key, { nombre, cantidades: [] });
      }

      if (cantidad > 0) {
        productosMap.get(key)!.cantidades.push(cantidad);
      }
    });
  });

  // Calcular estadísticos
  const resultado = Array.from(productosMap.entries()).map(([id, data]) => {
    const cantidades = data.cantidades.length > 0 ? data.cantidades : [0];
    return {
      id,
      nombre: data.nombre,
      totalVentas: data.cantidades.length,
      totalUnidades: cantidades.reduce((a, b) => a + b, 0),
      media: Number(calcularMedia(cantidades)).toFixed(2),
      mediana: Number(calcularMediana(cantidades)).toFixed(2),
      moda: Number(calcularModa(cantidades)),
      min: Math.min(...cantidades),
      max: Math.max(...cantidades)
    };
  });

  // Ordenar según el estadístico seleccionado
  const estadisticoActual = estadisticoProductos.value;
  return resultado.sort((a, b) => {
    const getNumValue = (val: string | number) => typeof val === 'string' ? parseFloat(val) : val;
    const aVal = getNumValue(a[estadisticoActual]);
    const bVal = getNumValue(b[estadisticoActual]);
    return typeof bVal === 'number' ? bVal - aVal : 0;
  });
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

const buscarTodas = async (): Promise<void> => {
  cargando.value = true;
  error.value = '';
  try {
    // Cargar ventas
    const ventasResponse = await api.get('ventas');
    const ventasData = Array.isArray(ventasResponse.data) ? ventasResponse.data : [ventasResponse.data];

    // Cargar productos desde /productos/all
    const productosResponse = await api.get('productos/all');
    const productosData = Array.isArray(productosResponse.data) ? productosResponse.data : [productosResponse.data];

    // Crear mapa id -> nombre
    const productosMap = new Map<number, string>();
    productosData.forEach((prod: { id: number; nombre: string }) => {
      productosMap.set(prod.id, prod.nombre);
    });

    // Enriquecer ventas con nombres de productos
    const ventasEnriquecidas = ventasData.map(venta => ({
      ...venta,
      detallesVenta: venta.detallesVenta.map((detalle: { id: number; producto_id: number; producto?: { nombre: string }; cantidad: number; precio_unitario: number }) => ({
        ...detalle,
        producto: {
          nombre: productosMap.get(detalle.producto_id) || `Producto #${detalle.producto_id}`
        }
      }))
    }));

    ventas.value = ventasEnriquecidas;
    error.value = '';
  } catch (err) {
    const msg = (err instanceof Error) ? err.message : 'Error al cargar todas las ventas';
    error.value = msg;
    console.error('Error al cargar todas las ventas:', err);
  } finally {
    cargando.value = false;
  }
};

const buscarPorId = async (): Promise<void> => {
  if (!detalleId.value) {
    error.value = 'Debes ingresar un ID válido.';
    return;
  }
  cargando.value = true;
  ventas.value = [];
  try {
    const ventasResponse = await api.get(`ventas/${detalleId.value}`);
    const venta = ventasResponse.data;

    if (venta) {
      // Cargar productos desde /productos/all
      const productosResponse = await api.get('productos/all');
      const productosData = Array.isArray(productosResponse.data) ? productosResponse.data : [productosResponse.data];

      // Crear mapa id -> nombre
      const productosMap = new Map<number, string>();
      productosData.forEach((prod: { id: number; nombre: string }) => {
        productosMap.set(prod.id, prod.nombre);
      });

      // Enriquecer venta con nombres de productos
      const ventaEnriquecida = {
        ...venta,
        detallesVenta: venta.detallesVenta.map((detalle: { id: number; producto_id: number; producto?: { nombre: string }; cantidad: number; precio_unitario: number }) => ({
          ...detalle,
          producto: {
            nombre: productosMap.get(detalle.producto_id) || `Producto #${detalle.producto_id}`
          }
        }))
      };

      ventas.value = [ventaEnriquecida];
    }
    error.value = '';
  } catch (err) {
    const msg = (err instanceof Error) ? err.message : 'No se encontró la venta o hubo un error.';
    error.value = msg;
    console.error('Error al buscar por ID:', err);
  } finally {
    cargando.value = false;
  }
};

const buscarPorRangoFechas = async (): Promise<void> => {
  if (!fechaInicio.value || !fechaFin.value) {
    error.value = 'Debes seleccionar ambas fechas.';
    return;
  }

  const inicio = new Date(fechaInicio.value);
  const fin = new Date(fechaFin.value);

  if (inicio > fin) {
    error.value = 'La fecha de inicio no puede ser mayor que la fecha de fin.';
    return;
  }

  cargando.value = true;
  ventas.value = [];
  error.value = '';

  try {
    const response = await api.get('ventas');
    const todasLasVentas = Array.isArray(response.data) ? response.data : [response.data];

    // Filtrar por rango de fechas
    const ventasFiltradas = todasLasVentas.filter((venta: Venta) => {
      const fechaVenta = new Date(venta.fecha_venta);
      return fechaVenta >= inicio && fechaVenta <= new Date(fin.getTime() + 86400000);
    });

    // Cargar productos desde /productos/all
    const productosResponse = await api.get('productos/all');
    const productosData = Array.isArray(productosResponse.data) ? productosResponse.data : [productosResponse.data];

    // Crear mapa id -> nombre
    const productosMap = new Map<number, string>();
    productosData.forEach((prod: { id: number; nombre: string }) => {
      productosMap.set(prod.id, prod.nombre);
    });

    // Enriquecer ventas con nombres de productos
    const ventasEnriquecidas = ventasFiltradas.map(venta => ({
      ...venta,
      detallesVenta: venta.detallesVenta.map((detalle: { id: number; producto_id: number; producto?: { nombre: string }; cantidad: number; precio_unitario: number }) => ({
        ...detalle,
        producto: {
          nombre: productosMap.get(detalle.producto_id) || `Producto #${detalle.producto_id}`
        }
      }))
    }));

    ventas.value = ventasEnriquecidas;

    if (ventas.value.length === 0) {
      error.value = 'No se encontraron ventas en el rango de fechas especificado.';
    }
  } catch (err) {
    const msg = (err instanceof Error) ? err.message : 'Error al buscar ventas por rango de fechas.';
    error.value = msg;
    console.error('Error al buscar por rango de fechas:', err);
  } finally {
    cargando.value = false;
  }
};

const eliminarVenta = async (ventaId: number): Promise<void> => {
  if (!confirm('⚠️ ATENCIÓN: Se eliminará la venta #' + ventaId + ' y todos sus detalles asociados. ¿Deseas continuar?')) {
    return;
  }

  cargando.value = true;
  error.value = '';
  try {
    console.log(`🔴 Eliminando venta ${ventaId}...`);

    // Eliminar la venta - el backend debe tener cascades configurados
    await api.delete(`ventas/${ventaId}`);

    console.log(`✅ Venta ${ventaId} y detalles eliminados correctamente`);

    // Actualizar la lista local
    ventas.value = ventas.value.filter(v => v.id !== ventaId);
    error.value = '';
  } catch (err) {
    const message = (err instanceof Error) ? err.message : 'Error desconocido';

    if (message.includes('404')) {
      error.value = '❌ No se encontró la venta. Recarga la página e intenta nuevamente.';
    } else if (message.includes('400')) {
      error.value = '❌ No se puede eliminar esta venta. Verifica que no tenga transacciones vinculadas.';
    } else {
      error.value = `❌ Error al eliminar: ${message}`;
    }

    console.error('Error al eliminar venta:', err);
  } finally {
    cargando.value = false;
  }
};

watch(modo, () => {
  error.value = '';
  detalleId.value = '';
  fechaInicio.value = '';
  fechaFin.value = '';
  ventas.value = [];
});
</script>

<template>
  <div class="contenedor">
    <div class="header-section q-mb-lg">
      <h2>🧾 Consultas de Ventas</h2>
      <p class="text-subtitle2 text-grey-7">Resumen de operaciones y facturación</p>
    </div>

    <!-- KPI Panels Row - Dashboard Style -->
    <div class="row q-col-gutter-md q-mb-md">
      <!-- Total Income Card - Larger -->
      <div class="col-sm-8">
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

      <!-- Transaction Count Card - Smaller -->
      <div class="col-sm-4">
        <div class="kpi-card bg-white text-grey-9 border-gradient">
          <div class="kpi-icon text-orange-8">
            <q-icon name="receipt_long" size="1.5rem" />
          </div>
          <div class="kpi-content">
            <div class="kpi-label text-grey-6">Transacciones</div>
            <div class="kpi-value text-h4 text-weight-bold text-grey-9">{{ ventas.length }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Methods Breakdown Row - 4 Columns -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-green-8">
            <q-icon name="attach_money" /> Efectivo
          </div>
          <div class="stat-amount">{{ formatCurrency(statsCalculadas.efectivo) }}</div>
        </div>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-blue-8">
            <q-icon name="credit_card" /> Tarjeta
          </div>
          <div class="stat-amount">{{ formatCurrency(statsCalculadas.tarjeta) }}</div>
        </div>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-purple-8">
            <q-icon name="account_balance" /> Transferencia
          </div>
          <div class="stat-amount">{{ formatCurrency(statsCalculadas.transferencia) }}</div>
        </div>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <div class="mini-stat-card">
          <div class="stat-label text-teal-8">
            <q-icon name="local_atm" /> Dólares
          </div>
          <div class="stat-amount">USD {{ formatNumber(statsCalculadas.usd) }}</div>
        </div>
      </div>
    </div>

    <!-- Facturación Row - 2 Columns -->
    <div class="row q-col-gutter-md q-mb-xl">
      <div class="col-12 col-sm-6">
        <div class="facturacion-card global">
          <q-icon name="public" size="1.5rem" />
          <div>
            <div class="label">Facturación Global</div>
            <div class="value">{{ formatCurrency(statsCalculadas.totalVentasSinFactura) }}</div>
          </div>
        </div>
      </div>
      <div class="col-12 col-sm-6">
        <div class="facturacion-card contado">
          <q-icon name="description" size="1.5rem" />
          <div>
            <div class="label">Facturación Contado</div>
            <div class="value">{{ formatCurrency(statsCalculadas.totalVentasConFactura) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estadísticos de Productos -->
    <div class="q-mb-xl">
      <div class="header-analisis">
        <h3 class="text-h5 q-mb-md">📊 Análisis de Productos</h3>
        <button @click="mostrarAnalisis = !mostrarAnalisis" class="toggle-btn">
          {{ mostrarAnalisis ? '▼ Ocultar' : '▶ Mostrar' }}
        </button>
      </div>

      <div v-if="mostrarAnalisis">
        <div class="stats-buttons q-mb-md">
          <button @click="estadisticoProductos = 'media'" :class="{ active: estadisticoProductos === 'media' }"
            class="stat-btn">
            📈 Media
          </button>
          <button @click="estadisticoProductos = 'mediana'" :class="{ active: estadisticoProductos === 'mediana' }"
            class="stat-btn">
            📊 Mediana
          </button>
          <button @click="estadisticoProductos = 'moda'" :class="{ active: estadisticoProductos === 'moda' }"
            class="stat-btn">
            🎯 Moda
          </button>
        </div>

        <div v-if="estadisticasProductos.length > 0" class="productos-tabla">
          <table class="tabla-productos">
            <thead>
              <tr>
                <th>#</th>
                <th>Producto</th>
                <th># Ventas</th>
                <th>Total Unidades</th>
                <th>Media</th>
                <th>Mediana</th>
                <th>Moda</th>
                <th>Min - Max</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(prod, idx) in estadisticasProductos" :key="prod.id" :class="{ highlight: idx === 0 }">
                <td class="rank">{{ idx + 1 }}</td>
                <td class="producto-name">{{ prod.nombre }}</td>
                <td>{{ prod.totalVentas }}</td>
                <td class="font-bold">{{ prod.totalUnidades }}</td>
                <td :class="{ highlight_row: estadisticoProductos === 'media' }">{{ prod.media }}</td>
                <td :class="{ highlight_row: estadisticoProductos === 'mediana' }">{{ prod.mediana }}</td>
                <td :class="{ highlight_row: estadisticoProductos === 'moda' }">{{ prod.moda }}</td>
                <td>{{ prod.min }} - {{ prod.max }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">
          <p>No hay datos de productos disponibles</p>
        </div>
      </div>
    </div>

    <div class="selector-modo">
      <label for="modo">Modo de búsqueda:</label>
      <select v-model="modo" id="modo">
        <option value="todas">Ver todas las ventas</option>
        <option value="porId">Buscar por ID</option>
        <option value="porFechas">Buscar por rango de fechas</option>
      </select>
    </div>

    <div v-if="modo === 'porId'" class="busqueda-id">
      <input v-model="detalleId" type="number" placeholder="🔍 Buscar ID de venta" class="input-estilizado" />
      <button @click="buscarPorId" class="btn">Buscar</button>
    </div>

    <div v-if="modo === 'porFechas'" class="busqueda-fechas">
      <div class="rango-fechas-container">
        <div class="fecha-group">
          <label for="fechaInicio">Fecha inicio:</label>
          <input v-model="fechaInicio" type="date" id="fechaInicio" class="input-fecha" />
        </div>
        <div class="fecha-group">
          <label for="fechaFin">Fecha fin:</label>
          <input v-model="fechaFin" type="date" id="fechaFin" class="input-fecha" />
        </div>
        <button @click="buscarPorRangoFechas" class="btn">Buscar por rango</button>
      </div>
    </div>

    <div v-if="modo === 'todas'" class="busqueda-todas">
      <button @click="buscarTodas" class="btn">Ver todas las ventas</button>
    </div>

    <div v-if="cargando" class="mensaje">⌛ Cargando...</div>
    <div v-else-if="error" class="mensaje error">{{ error }}</div>

    <table v-if="ventas.length > 0" class="tabla">
      <thead>
        <tr>
          <th>ID</th>
          <th>Cliente</th>
          <th>Fecha</th>
          <th>Total</th>
          <th>Productos</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="v in ventas" :key="v.id">
          <td>{{ v.id }}</td>
          <td>{{ v.cliente || 'Sin cliente' }}</td>
          <td>{{ v.fecha_venta ? new Date(v.fecha_venta).toLocaleString() : 'N/A' }}</td>
          <td><strong>${{ Number(v.total).toLocaleString() }}</strong></td>
          <td>
            <ul class="lista-productos">
              <li v-for="d in v.detallesVenta" :key="d.id">
                • {{ d.producto?.nombre || `Prod #${d.producto_id}` }}
                (x{{ d.cantidad }} a ${{ d.precio_unitario }})
              </li>
            </ul>
          </td>
          <td>
            <button @click="eliminarVenta(v.id)" class="btn-eliminar" title="Eliminar venta y detalles">
              🗑️ Eliminar
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
h2 {
  color: #333;
  font-size: 1.8rem;
  margin: 0;
}

.contenedor {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-family: 'Segoe UI', sans-serif;
}

.selector-modo,
.busqueda-id,
.busqueda-fechas,
.busqueda-todas {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.rango-fechas-container {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
  width: 100%;
}

.fecha-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fecha-group label {
  font-weight: 500;
  color: #333;
  min-width: 100px;
}

.input-fecha {
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #ccc;
  outline: none;
  font-size: 16px;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.input-fecha:focus {
  box-shadow: 0 0 0 2px rgba(255, 213, 79, 0.27);
  border-color: var(--color-brand-primary);
}

.input-estilizado {
  flex: 1;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid #ccc;
  outline: none;
  font-size: 16px;
  transition: box-shadow 0.2s ease;
}

.input-estilizado:focus {
  box-shadow: 0 0 0 2px rgba(255, 213, 79, 0.27);
  border-color: var(--color-brand-primary);
}

.btn {
  padding: 10px 20px;
  background: var(--gradient-brand-90);
  color: white;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.3s ease;
}

.btn:hover {
  background: var(--color-brand-secondary);
}

.btn-eliminar {
  padding: 8px 16px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: background 0.3s ease, transform 0.2s ease;
  white-space: nowrap;
}

.btn-eliminar:hover {
  background-color: #c82333;
  transform: scale(1.05);
}

.btn-eliminar:active {
  transform: scale(0.95);
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  margin-top: 2rem;
}

.tabla th,
.tabla td {
  padding: 12px;
  border-bottom: 1px solid #ddd;
  text-align: left;
  vertical-align: top;
}

.tabla th {
  background-color: #f4f4f4;
  font-weight: bold;
}

.mensaje {
  margin-top: 1rem;
  font-weight: bold;
}

.error {
  color: red;
}

.lista-productos {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.9rem;
}

.lista-productos li {
  margin-bottom: 4px;
}

.contenedor {
  background-color: #f8fafc;
  min-height: 100vh;
}

.gradient-bg {
  background: var(--gradient-brand-135);
}

.text-primary {
  color: var(--color-brand-secondary) !important;
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
  background: linear-gradient(to bottom, var(--color-brand-primary), var(--color-brand-secondary));
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

/* Mini Cards */
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
  background: var(--gradient-brand-135);
  border-color: var(--color-brand-primary);
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

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  width: 100%;
  margin: 0;
}

.row.q-col-gutter-md {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  /* Deja que Quasar maneje el espacio internamente */
  margin: 0 -12px;
  /* Margen negativo estándar de Quasar para compensar gutters */
}

.row.q-col-gutter-sm {
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.col-12 {
  flex: 0 0 100%;
}

.col-6 {
  flex: 0 0 48%;
}

.col-sm-4 {
  flex: 0 0 33.33% !important;
  /* Valor exacto para 4/12 */
  max-width: 33.33%;
}

.col-sm-6 {
  flex: 0 0 48% !important;
}

.col-sm-8 {
  flex: 0 0 66.66% !important;
  /* Valor exacto para 8/12 */
  max-width: 66.66%;
}

.col-md-6 {
  flex: 0 0 48%;
}

.col-md-12 {
  flex: 0 0 100%;
}

.col-md-3 {
  flex: 0 0 23%;
}

.q-mb-md {
  margin-bottom: 1.5rem;
}

.q-mb-xl {
  margin-bottom: 3rem;
}

.q-icon {
  display: inline-block;
  width: 2.5rem;
  height: 2.5rem;
}

.text-white {
  color: white;
}

.text-grey-9 {
  color: #333;
}

.text-grey-6 {
  color: #999;
}

.text-green-8 {
  color: #16a34a;
}

.text-blue-8 {
  color: #1e40af;
}

.text-purple-8 {
  color: #7e22ce;
}

.text-teal-8 {
  color: #0d9488;
}

.text-orange-8 {
  color: #ea580c;
}

.bg-white {
  background: white;
}

/* Estilos para inputs */
.input-estilizado,
.input-fecha,
select {
  border: 1px solid #e2e8f0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #f8fafc;
}

@media (max-width: 1024px) {
  .col-6 {
    flex: 0 0 48%;
  }
}

@media (max-width: 599px) {

  .col-sm-4,
  .col-sm-6,
  .col-sm-8 {
    flex: 0 0 100% !important;
  }
}

@media (min-width: 600px) {
  .col-sm-4 {
    flex: 0 0 32% !important;
  }

  .col-sm-6 {
    flex: 0 0 48% !important;
  }

  .col-sm-8 {
    flex: 0 0 66% !important;
  }
}

@media (max-width: 768px) {
  .col-6 {
    flex: 0 0 100%;
  }

  .col-md-6 {
    flex: 0 0 100%;
  }

  .col-md-3 {
    flex: 0 0 100%;
  }

  .kpi-card {
    flex-direction: column;
    text-align: center;
  }
}

/* Estadísticos de Productos */
.header-analisis {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.header-analisis h3 {
  margin: 0;
  flex: 1;
}

.toggle-btn {
  padding: 10px 18px;
  background: var(--gradient-brand-135);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(217, 164, 65, 0.2);
}

.toggle-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(217, 164, 65, 0.3);
}

.toggle-btn:active {
  transform: translateY(0);
}

.stats-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat-btn {
  padding: 12px 24px;
  border: 2px solid #e2e8f0;
  background: white;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  color: #64748b;
}

.stat-btn:hover {
  border-color: var(--color-brand-primary);
  color: var(--color-brand-primary);
}

.stat-btn.active {
  background: var(--gradient-brand-135);
  border-color: var(--color-brand-primary);
  color: white;
  box-shadow: 0 4px 12px rgba(217, 164, 65, 0.3);
}

.productos-tabla {
  background: white;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.tabla-productos {
  width: 100%;
  border-collapse: collapse;
}

.tabla-productos thead {
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
}

.tabla-productos th {
  padding: 16px 12px;
  text-align: left;
  font-weight: 700;
  color: #475569;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tabla-productos td {
  padding: 14px 12px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  color: #334155;
}

.tabla-productos tbody tr:hover {
  background: #f8fafc;
}

.tabla-productos tbody tr.highlight {
  background: #fef3c7;
  font-weight: 600;
}

.tabla-productos tbody tr.highlight:hover {
  background: #fde68a;
}

.rank {
  font-weight: 700;
  color: var(--color-brand-primary);
  font-size: 1.1rem;
}

.producto-name {
  font-weight: 600;
  color: #1e293b;
}

.highlight_row {
  background: rgba(217, 164, 65, 0.1);
  font-weight: 700;
  color: var(--color-brand-primary);
}

.font-bold {
  font-weight: 700;
}

.empty-state {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  font-weight: 500;
}

h3 {
  color: #1e293b;
  font-weight: 700;
}

@media (max-width: 600px) {
  .header-analisis {
    flex-direction: column;
    align-items: stretch;
  }

  .toggle-btn {
    width: 100%;
    text-align: center;
  }
}
</style>
