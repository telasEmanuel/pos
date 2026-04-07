<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api/axios';
import CrearProveedor from '../components/CrearProveedores.vue';

interface Proveedor {
  id: number
  nombre: string
  contacto: string
  telefono?: string
  direccion?: string
}

const proveedores = ref<Proveedor[]>([])
const loading = ref(false)
const showCrear = ref(false)
const proveedorEditar = ref<Proveedor | undefined>(undefined)

// Abrir y cerrar modal
const abrirModalCrear = () => {
  proveedorEditar.value = undefined
  showCrear.value = true
}

const abrirModalEditar = (proveedor: Proveedor) => {
  proveedorEditar.value = proveedor
  showCrear.value = true
}

const cerrarModal = () => showCrear.value = false

// Cuando se crea un proveedor nuevo
const onProveedorCreado = (nuevo: Proveedor): void => {
  alert('Proveedor creado exitosamente');
  proveedores.value.push(nuevo);
  cerrarModal();
};

// Cuando se actualiza un proveedor
const onProveedorActualizado = (actualizado: Proveedor): void => {
  const index = proveedores.value.findIndex(p => p.id === actualizado.id)
  if (index !== -1) {
    proveedores.value[index] = actualizado
  }
  alert('Proveedor actualizado exitosamente');
  cerrarModal();
}

// Eliminar proveedor
const eliminarProveedor = async (id: number) => {
  if (!confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
    return
  }

  try {
    await api.delete(`proveedores/${id}`)
    proveedores.value = proveedores.value.filter(p => p.id !== id)
    alert('Proveedor eliminado exitosamente');
  } catch (error) {
    console.error("Error al eliminar el proveedor:", error);
    alert('Error al eliminar el proveedor')
  }
}

// Obtener proveedores desde la API
const mostrarProveedores = async () => {
  try {
    const response = await api.get('proveedores');
    proveedores.value = response.data;
    loading.value = true;
  } catch (error) {
    console.error("Error al obtener los proveedores:", error);
  }
};

onMounted(() => {
  void mostrarProveedores();
});
</script>

<template>
  <h2>Proveedores</h2>

  <div v-if="!loading">
    <p>Trayendo proveedores...</p>
  </div>

  <div class="container" v-else>
    <button @click="abrirModalCrear" class="btn-editar">Agregar Proveedor</button>

    <table class="table table-striped">
      <thead>
        <tr>
          <!--<th>ID</th>-->
          <th>Nombre</th>
          <th>Contacto</th>
          <th>Teléfono</th>
          <th>Dirección</th>
          <th>Editar</th>
          <th>Eliminar</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="proveedor in proveedores" :key="proveedor.id">
          <!--<td>{{ proveedor.id }}</td>-->
          <td>{{ proveedor.nombre }}</td>
          <td>{{ proveedor.contacto }}</td>
          <td>{{ proveedor.telefono }}</td>
          <td>{{ proveedor.direccion }}</td>
          <td>
            <button @click="abrirModalEditar(proveedor)" class="btn-editar">Editar</button>
          </td>
          <td>
            <button @click="eliminarProveedor(proveedor.id)" class="btn-eliminar">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Modal para crear/editar proveedor -->
    <CrearProveedor :visible="showCrear" :proveedor="proveedorEditar" @close="cerrarModal"
      @proveedorCreado="onProveedorCreado" @proveedorActualizado="onProveedorActualizado" />
  </div>
</template>
<style scoped>
.container {
  margin: 20px;
}

.table {
  width: 100%;
  margin-top: 20px;
}

.table th,
.table td {
  text-align: left;
  padding: 8px;
}

.table th {
  background-color: #f2f2f2;
}

.table-striped tbody tr:nth-of-type(odd) {
  background-color: #f9f9f9;
}

.table-striped tbody tr:nth-of-type(even) {
  background-color: #fff;
}

.table-striped tbody tr:hover {
  background-color: #f1f1f1;
}

.table-striped {
  border-collapse: collapse;
  width: 100%;
}

.table-striped th,
.table-striped td {
  border: 1px solid #ddd;
  padding: 8px;
}

.table-striped th {
  background-color: #f2f2f2;
  text-align: left;
}

.table-striped tbody tr:hover {
  background-color: #f1f1f1;
}

.btn-editar,
.btn-eliminar {
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.2s ease;
  margin-right: 0.5rem;
}

.btn-editar {
  background: var(--gradient-brand-90);
}

.btn-editar:hover {
  background: var(--color-brand-secondary);
}

.btn-eliminar {
  background: #ef4444;
}

.btn-eliminar:hover {
  background: #dc2626;
}
</style>
