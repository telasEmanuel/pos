<script setup lang="ts">
import { onMounted, ref } from 'vue'
import OrdenCompraModal from '../components/CrearOrdenes.vue';
import EditarOrdenModal from '../components/EditarOrdenes.vue';
import api from '../api/axios'

const loading = ref<boolean>(false);
const ordenes = ref<Array<{ id: number; proveedor_id: number; estado: string;[key: string]: unknown }>>([])
const showModal = ref<boolean>(false);
const showEditModal = ref<boolean>(false);
const ordenSeleccionada = ref<{ id: number; proveedor_id: number; estado: string;[key: string]: unknown } | null>(null);

const mostrarOrdenes = async (): Promise<void> => {
  try {
    const response = await api.get('ordenes');
    ordenes.value = response.data;
    loading.value = true;
  } catch (error) {
    console.log("Hubo un error al obtener las ordenes de compra\n" + (error instanceof Error ? error.message : String(error)));
  }
};

function onCreated(): void {
  alert('Orden creada correctamente');
  showModal.value = false;
  void mostrarOrdenes();
}

function onEdited(): void {
  alert('Orden actualizada correctamente');
  showEditModal.value = false;
  void mostrarOrdenes();
}

function editarOrden(orden: { id: number; proveedor_id: number; estado: string;[key: string]: unknown }): void {
  ordenSeleccionada.value = orden;
  showEditModal.value = true;
}

function formatearFecha(fechaISO: string | number | Date): string {
  const fecha = new Date(fechaISO);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yyyy = fecha.getFullYear();
  const hh = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  const ss = String(fecha.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} - ${hh}:${min}:${ss}`;
}

onMounted((): void => {
  void mostrarOrdenes();
});
</script>

<template>
  <div class="container">
    <h1>Órdenes de Compra</h1>

    <div v-if="!loading">
      <p>Cargando órdenes de compra...</p>
    </div>

    <table class="table table-striped" v-else>
      <thead>
        <tr>
          <th>ID</th>
          <th>Proveedor</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="orden in ordenes" :key="orden.id">
          <td>{{ orden.id }}</td>
          <td>{{ (orden.proveedor as any).nombre }}</td>
          <td>{{ formatearFecha(orden.fecha_orden as string) }}</td>
          <td>{{ orden.estado.toUpperCase() }}</td>
          <td>
            <button @click="editarOrden(orden)" id="botonsito">Editar</button>
          </td>
        </tr>
      </tbody>
    </table>

    <button @click="showModal = true" id="boton">Nueva Orden de Compra</button>

    <!-- Modal para crear -->
    <OrdenCompraModal :show="showModal" @close="showModal = false" @created="onCreated" />

    <!-- Modal para editar -->
    <EditarOrdenModal v-if="ordenSeleccionada" :show="showEditModal" :orden="ordenSeleccionada"
      @close="showEditModal = false" @edited="onEdited" />
  </div>
</template>

<style scoped>
h1 {
  color: #333;
  font-size: 1.8rem;
  margin: 0;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.table {
  width: 100%;
  margin-bottom: 1rem;
  color: #212529;
}

.table th,
.table td {
  padding: 0.75rem;
  vertical-align: top;
  border-top: 1px solid #dee2e6;
}

.table thead th {
  vertical-align: bottom;
  border-bottom: 2px solid #dee2e6;
}

.table-striped tbody tr:nth-of-type(odd) {
  background-color: rgba(0, 0, 0, 0.05);
}

.table-striped tbody tr:nth-of-type(even) {
  background-color: #fff;
}

.table-striped tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.075);
}

#botonsito {
  background: #4f8cff;
  color: #fff;
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 200;
  box-shadow: 0 2px 8px rgba(79, 140, 255, 0.10);
  cursor: pointer;
  transition: background 0.18s, transform 0.12s;
  margin-top: 5px;
  margin-bottom: 5px;
  letter-spacing: 0.5px;
}

#botonsito:hover {
  background: #2563eb;
  transform: translateY(-2px) scale(1.03);
}
</style>
