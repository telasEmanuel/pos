<script setup lang="ts">
import { ref, watch } from 'vue';
import api from '../api/axios';

const modo = ref('todas');
const detalleId = ref('');
const ventas = ref<Array<{ id: number; cliente?: string; fecha_venta: string; total: number; detallesVenta: Array<{ id: number; producto_id: number; producto?: { nombre: string }; cantidad: number; precio_unitario: number }> }>>([])
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

watch(modo, () => {
  error.value = '';
  detalleId.value = '';
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
      </select>
    </div>

    <div v-if="modo === 'porId'" class="busqueda-id">
      <input v-model="detalleId" type="number" placeholder="🔍 Buscar ID de venta" class="input-estilizado" />
      <button @click="buscarPorId" class="btn">Buscar</button>
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
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
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
.busqueda-todas {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 10px;
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
  box-shadow: 0 0 0 2px #007bff44;
  border-color: #007bff;
}

.btn {
  padding: 10px 20px;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.3s ease;
}

.btn:hover {
  background-color: #1558d6;
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
