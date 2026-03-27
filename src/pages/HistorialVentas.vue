<script setup lang="ts">
import { ref, watch } from 'vue';
import api from '../api/axios';

type Venta = { id: number; cliente?: string; fecha_venta: string; total: number; detallesVenta: Array<{ id: number; producto_id: number; producto?: { nombre: string }; cantidad: number; precio_unitario: number }> }

const modo = ref('todas');
const detalleId = ref('');
const fechaInicio = ref('');
const fechaFin = ref('');
const ventas = ref<Venta[]>([])
const cargando = ref(false);
const error = ref('');

const buscarTodas = async (): Promise<void> => {
  cargando.value = true;
  error.value = '';
  try {
    const response = await api.get('ventas');
    ventas.value = Array.isArray(response.data) ? response.data : [response.data];
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
    const response = await api.get(`ventas/${detalleId.value}`);
    const data = response.data;
    ventas.value = data ? [data] : [];
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

    ventas.value = todasLasVentas.filter((venta: Venta) => {
      const fechaVenta = new Date(venta.fecha_venta);
      return fechaVenta >= inicio && fechaVenta <= new Date(fin.getTime() + 86400000); // +1 día para incluir el día fin completo
    });

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
    <h2>🧾 Consultas de Ventas</h2>

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
  max-width: 1000px;
  margin: 2rem auto;
  padding: 1.5rem;
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
</style>
