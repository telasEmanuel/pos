<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api/axios';
import CrearProveedor from '../components/CrearProveedores.vue';

const proveedores = ref<Array<{ id: number; nombre: string; contacto: string; telefono?: string }>>([])
const loading = ref(false)
const showCrear = ref(false)

// Abrir y cerrar modal
const abrirModal = () => showCrear.value = true
const cerrarModal = () => showCrear.value = false

// Cuando se crea un proveedor nuevo
const onProveedorCreado = (nuevo: { id: number; nombre: string; contacto: string; telefono?: string }): void => {
  alert('Proveedor creado exitosamente');
  proveedores.value.push(nuevo);
  cerrarModal();
};

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
    <button @click="abrirModal" id="boton">Agregar Proveedor</button>

    <table class="table table-striped">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Contacto</th>
          <th>Teléfono</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="proveedor in proveedores" :key="proveedor.id">
          <td>{{ proveedor.id }}</td>
          <td>{{ proveedor.nombre }}</td>
          <td>{{ proveedor.contacto }}</td>
          <td>{{ proveedor.telefono }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Modal para crear proveedor -->
    <CrearProveedor :visible="showCrear" @close="cerrarModal" @proveedorCreado="onProveedorCreado" />
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
</style>
