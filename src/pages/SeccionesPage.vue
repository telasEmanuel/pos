<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../api/axios'
import CrearSeccion from '../components/CrearSeccion.vue'
import UpdateSeccion from '../components/UpdateSeccion.vue'

interface Seccion {
  id: number
  nombre: string
  descripcion?: string
  orden?: number
}

const secciones = ref<Seccion[]>([])
const error = ref<string | null>(null)
const loading = ref(true)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const seccionSeleccionada = ref<Seccion | null>(null)

const abrirCreateModal = (): void => {
  showCreateModal.value = true
}

const cerrarCreateModal = (): void => {
  showCreateModal.value = false
}

const cerrarEditModal = (): void => {
  showEditModal.value = false
  seccionSeleccionada.value = null
}

const onSeccionCreada = (): void => {
  alert('Sección creada exitosamente')
  void cargarSecciones()
  cerrarCreateModal()
  window.location.reload()
}

const onSeccionActualizada = (): void => {
  alert('Sección actualizada exitosamente')
  void cargarSecciones()
  cerrarEditModal()
  window.location.reload()
}

const abrirEditModal = (seccion: Seccion): void => {
  seccionSeleccionada.value = seccion
  showEditModal.value = true
}

// Función para eliminar sección
const eliminarSeccion = async (id: number): Promise<void> => {
  if (!confirm('¿Estás seguro de que quieres eliminar esta sección?')) {
    return
  }

  try {
    await api.delete(`secciones/${id}`)
    alert('Sección eliminada correctamente')
    await cargarSecciones()
    window.location.reload()
  } catch (err) {
    console.error('Error al eliminar sección:', err)
    alert('Error al eliminar la sección')
  }
}

const cargarSecciones = async (): Promise<void> => {
  try {
    const response = await api.get('secciones')
    secciones.value = response.data
    loading.value = false
  } catch (err) {
    error.value = 'Error al obtener las secciones'
    console.error(err)
  }
}

onMounted((): void => {
  void cargarSecciones()
})
</script>

<template>
  <div class="container">
    <h1>Gestión de Secciones</h1>

    <div v-if="loading" class="loading">
      <p>Cargando secciones...</p>
    </div>

    <div v-else>
      <button @click="abrirCreateModal()" id="boton">Crear Sección</button>

      <table v-if="secciones.length" class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Editar</th>
            <th>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="seccion in secciones" :key="seccion.id">
            <td>{{ seccion.nombre }}</td>
            <td>{{ seccion.descripcion || 'N/A' }}</td>
            <td>
              <button @click="abrirEditModal(seccion)" class="btn-editar">
                Editar
              </button>
            </td>
            <td>
              <button @click="eliminarSeccion(seccion.id)" class="btn-eliminar">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="no-data">
        <p>No hay secciones disponibles</p>
      </div>

      <div v-if="error" class="error">
        {{ error }}
      </div>
    </div>

    <!-- Modal para crear sección -->
    <CrearSeccion :visible="showCreateModal" @close="cerrarCreateModal" @seccionCreada="onSeccionCreada" />

    <!-- Modal para editar sección -->
    <UpdateSeccion v-if="seccionSeleccionada" :visible="showEditModal" :seccion="seccionSeleccionada"
      @close="cerrarEditModal" @seccionActualizada="onSeccionActualizada" />
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
