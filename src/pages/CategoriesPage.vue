<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../api/axios'
import CrearCategoria from '../components/CrearCategoria.vue'
import UpdateCategorie from '../components/UpdateCategorie.vue'

const categorias = ref<Array<{ id: number; nombre: string; descripcion?: string }>>([])
const error = ref<string | null>(null)
const loading = ref(true)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const categoriaSeleccionada = ref<{ id: number; nombre: string; descripcion?: string; seccion_id?: number } | null>(null)

const abrirCreateModal = (): void => {
  showCreateModal.value = true
}

const cerrarCreateModal = (): void => {
  showCreateModal.value = false
}

const cerrarEditModal = (): void => {
  showEditModal.value = false
  categoriaSeleccionada.value = null
}

const onCategoriaCreada = (): void => {
  alert('Categoría creada exitosamente')
  void cargarCategorias()
  cerrarCreateModal()
  window.location.reload() // Recargar la página para reflejar cambios
}

const onCategoriaActualizada = (): void => {
  alert('Categoría actualizada exitosamente')
  void cargarCategorias()
  cerrarEditModal()
  window.location.reload() // Recargar la página para reflejar cambios
}

const abrirEditModal = (categoria: { id: number; nombre: string; descripcion?: string }): void => {
  categoriaSeleccionada.value = categoria
  showEditModal.value = true
}

// Función para eliminar categoría
const eliminarCategoria = async (id: number): Promise<void> => {
  if (!confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
    return
  }

  try {
    await api.delete(`categorias/${id}`)
    alert('Categoría eliminada correctamente')
    await cargarCategorias() // Recargar datos
    window.location.reload() // Recargar la página para reflejar cambios
  } catch (err) {
    console.error('Error al eliminar categoría:', err)
    alert('Error al eliminar la categoría')
  }
}

const cargarCategorias = async (): Promise<void> => {
  try {
    const response = await api.get('categorias')
    categorias.value = response.data
    loading.value = false
  } catch (err) {
    error.value = 'Error al obtener las categorías'
    console.error(err)
  }
}

onMounted((): void => {
  void cargarCategorias()
})
</script>

<template>
  <div class="container">
    <h1>Lista de Categorías</h1>

    <div v-if="loading" class="loading">
      <p>Cargando categorías...</p>
    </div>

    <div v-else>
      <!-- CAMBIO AQUÍ: usar abrirCreateModal() en lugar de showModal = true -->
      <button @click="abrirCreateModal()" id="boton">Crear Categoria</button>

      <table v-if="categorias.length" class="tabla">
        <thead>
          <tr>
            <!--<th>ID</th>-->
            <th>Nombre</th>
            <th>Ficha técnica</th>
            <th>Editar</th>
            <th>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="categoria in categorias" :key="categoria.id">
            <!--<td>{{ categoria.id }}</td>-->
            <td>{{ categoria.nombre }}</td>
            <td>{{ categoria.descripcion || 'Sin ficha técnica ' }}</td>
            <td><button @click="abrirEditModal(categoria)" class="btn-editar">Editar</button></td>
            <td><button @click="eliminarCategoria(categoria.id)" class="btn-eliminar">Eliminar</button></td>
          </tr>
        </tbody>
      </table>

      <div v-else class="no-data">
        <p>No hay categorías disponibles en este momento.</p>
      </div>
    </div>

    <!-- CAMBIO AQUÍ: usar showCreateModal en lugar de showModal -->
    <CrearCategoria :visible="showCreateModal" @close="cerrarCreateModal" @categoriaCreada="onCategoriaCreada" />

    <UpdateCategorie :show="showEditModal" :categoria="categoriaSeleccionada" @close="cerrarEditModal"
      @updated="onCategoriaActualizada" />
  </div>
</template>

<style scoped>
h1 {
  color: #333;
  font-size: 1.8rem;
  margin: 0;
}

.lista-categorias {
  padding: 1rem;
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.tabla th,
.tabla td {
  border: 1px solid #ddd;
  padding: 0.75rem;
  text-align: left;
}

.tabla th {
  background-color: #f4f4f4;
  font-weight: 600;
}

button {
  padding: 0.5rem 0.75rem;
  margin-top: 0.25rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  background: var(--gradient-brand-90);
  color: white;
  cursor: pointer;
  transition: background 0.2s ease;
}

button:hover {
  background: var(--color-brand-secondary);
}

.btn-editar {
  background: var(--gradient-brand-90);
  margin-right: 0.5rem;
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

#boton {
  background: var(--gradient-brand-90);
  padding: 0.7rem 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

#boton:hover {
  background: var(--color-brand-secondary);
}
</style>
