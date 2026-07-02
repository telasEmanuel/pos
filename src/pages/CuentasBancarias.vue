<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from 'src/api/axios';
import CrearCuenta from 'src/components/CrearCuenta.vue';
import UpdateCuenta from 'src/components/UpdateCuenta.vue';

interface Cuenta {
  id: number;
  nombre: string;
}

const cuentas = ref<Cuenta[]>([]);
const error = ref<string | null>(null);
const loading = ref(true);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const cuentaSeleccionada = ref<Cuenta | null>(null);

const abrirCreateModal = (): void => {
  showCreateModal.value = true;
};

const cerrarCreateModal = (): void => {
  showCreateModal.value = false;
};

const cerrarEditModal = (): void => {
  showEditModal.value = false;
  cuentaSeleccionada.value = null;
};

const onCuentaCreada = (): void => {
  alert('Cuenta creada exitosamente');
  void cargarCuentas();
  cerrarCreateModal();
  window.location.reload();
};

const onCuentaActualizada = (): void => {
  alert('Cuenta actualizada exitosamente');
  void cargarCuentas();
  cerrarEditModal();
  window.location.reload();
};

const abrirEditModal = (cuenta: Cuenta): void => {
  cuentaSeleccionada.value = cuenta;
  showEditModal.value = true;
};

const eliminarCuenta = async (id: number): Promise<void> => {
  if (!confirm('¿Estás seguro de que quieres eliminar esta cuenta bancaria?')) {
    return;
  }

  try {
    await api.delete(`cuentas/${id}`);
    alert('Cuenta eliminada correctamente');
    await cargarCuentas();
    window.location.reload();
  } catch (err) {
    console.error('Error al eliminar cuenta:', err);
    alert('Error al eliminar la cuenta');
  }
};

const cargarCuentas = async (): Promise<void> => {
  try {
    const response = await api.get('cuentas');
    cuentas.value = response.data;
    loading.value = false;
  } catch (err) {
    error.value = 'Error al obtener las cuentas';
    console.error(err);
  }
};

onMounted((): void => {
  void cargarCuentas();
});
</script>

<template>
  <div class="container">
    <h1>Gestión de Cuentas Bancarias</h1>

    <div v-if="loading" class="loading">
      <p>Cargando cuentas bancarias...</p>
    </div>

    <div v-else>
      <button @click="abrirCreateModal()" id="boton">Crear Cuenta Bancaria</button>

      <table v-if="cuentas.length" class="tabla">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Editar</th>
            <th>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cuenta in cuentas" :key="cuenta.id">
            <td>{{ cuenta.id }}</td>
            <td>{{ cuenta.nombre }}</td>
            <td>
              <button @click="abrirEditModal(cuenta)" class="btn-editar">
                Editar
              </button>
            </td>
            <td>
              <button @click="eliminarCuenta(cuenta.id)" class="btn-eliminar">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="no-data">
        <p>No hay cuentas bancarias disponibles</p>
      </div>

      <div v-if="error" class="error">
        {{ error }}
      </div>
    </div>

    <CrearCuenta :visible="showCreateModal" @close="cerrarCreateModal" @cuentaCreada="onCuentaCreada" />

    <UpdateCuenta v-if="cuentaSeleccionada" :visible="showEditModal" :cuenta="cuentaSeleccionada"
      @close="cerrarEditModal" @cuentaActualizada="onCuentaActualizada" />
  </div>
</template>

<style scoped>
.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  color: #333;
  font-size: 1.8rem;
  margin-bottom: 2rem;
}

#boton {
  background: var(--gradient-brand-90);
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 1.5rem;
  transition: background 0.2s ease;
}

#boton:hover {
  background: var(--color-brand-secondary);
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  color: #212529;
  background: white;
}

.tabla th,
.tabla td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

.tabla thead th {
  background-color: #f8f9fa;
  font-weight: 600;
  border-bottom: 2px solid #dee2e6;
}

.tabla tbody tr:hover {
  background-color: rgba(255, 213, 79, 0.05);
}

.btn-editar {
  background: var(--gradient-brand-90);
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  margin-right: 0.5rem;
  transition: background 0.2s ease;
}

.btn-editar:hover {
  background: var(--color-brand-secondary);
}

.btn-eliminar {
  background: #ef4444;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-eliminar:hover {
  background: #dc2626;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.no-data {
  text-align: center;
  padding: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
  color: #666;
}

.error {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}
</style>
