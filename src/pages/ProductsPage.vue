<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import api from '../api/axios'
import CrearProducto from '../components/CrearProducto.vue'
import CrearInventario from '../components/CrearInventario.vue';
import UpdateProd from '../components/ActualizarProd.vue';

const productos = ref<Array<{ id: number; nombre: string; descripcion?: string; precio?: number; precio_tap?: number; precio_comp?: number; categoria_id?: number }>>([])
const error = ref<string | null>(null)
const mostrarModal = ref(false)
const mostrarInventarioModal = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const showEditModal = ref(false)
type ProductType = { id?: number; nombre?: string; descripcion?: string; precio?: number; precio_tap?: number; precio_comp?: number; categoria_id?: number }
const productoSeleccionado = ref<ProductType | null>(null)
const cursor = ref<string | null>(null)
const hasMore = ref(true)
const LIMIT = 10
const categorias = ref<Array<{ id: number; nombre: string }>>([])
const categoriaSeleccionada = ref('')
const terminoBusqueda = ref('')

const onInventarioCreado = (): void => {
  alert('Inventario creado exitosamente');
  window.location.reload();
};

const debounce = (fn: (...args: unknown[]) => void, delay = 300): ((...args: unknown[]) => void) => {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: unknown[]): void => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

const buscar = (): void => {
  productos.value = []
  cursor.value = null
  hasMore.value = true
  void cargarProductos()
}

const resetearBusqueda = (): void => {
  productos.value = []
  cursor.value = null
  hasMore.value = true
}

const limpiarBusqueda = (): void => {
  terminoBusqueda.value = ''
  categoriaSeleccionada.value = ''
  productos.value = []
  cursor.value = null
  hasMore.value = true
  resetearBusqueda()
  void cargarProductos()
}

const productoCreado = (nuevoProducto: { id: number; nombre: string }): void => {
  console.log('Producto creado:', nuevoProducto)
  cerrarModalProducto()
  window.location.reload()
}

const abrirModalProducto = (): void => {
  mostrarModal.value = true
}

const cerrarModalProducto = (): void => {
  mostrarModal.value = false
}

const abrirModalInventario = (): void => {
  mostrarInventarioModal.value = true
}

const cerrarModalInventario = (): void => {
  mostrarInventarioModal.value = false
}

const abrirEditModal = (producto: { id: number; nombre: string; descripcion?: string; precio?: number; precio_tap?: number; categoria_id?: number }): void => {
  productoSeleccionado.value = producto
  showEditModal.value = true
}

const cerrarEditModal = (): void => {
  showEditModal.value = false
  productoSeleccionado.value = null
}

const onProductoActualizado = (): void => {
  alert('Producto actualizado exitosamente')
  void cargarProductos() // Recargar datos
}

// Función para eliminar producto
const eliminarProducto = async (id: number): Promise<void> => {
  if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) {
    return
  }

  try {
    await api.delete(`productos/${id}`)
    alert('Producto eliminado correctamente')
    await cargarProductos() // Recargar datos
  } catch (err) {
    console.error('Error al eliminar producto:', err)
    alert('Error al eliminar el producto')
  }
}

const cargarProductos = async (): Promise<void> => {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true

  try {
    const params = {
      limit: LIMIT,
      ...(cursor.value ? { cursor: cursor.value } : {}),
      ...(categoriaSeleccionada.value && { categoriaId: categoriaSeleccionada.value }),
      ...(terminoBusqueda.value && { busqueda: terminoBusqueda.value }),
    }

    // Si quieres cancelar llamadas anteriores (opcional)
    // if (cancelTokenSource.value) cancelTokenSource.value.cancel()
    // cancelTokenSource.value = axios.CancelToken.source()

    const response = await api.get('productos', {
      params
      // , cancelToken: cancelTokenSource.value.token
    })

    // Si es cursor null (primera página), reemplazamos productos, sino concatenamos
    if (!cursor.value) {
      productos.value = response.data.items
    } else {
      productos.value.push(...response.data.items)
    }

    hasMore.value = response.data.hasMore
    cursor.value = response.data.nextCursor
  } catch (err) {
    // Handle error silently for cancelled requests
    error.value = 'Error al obtener productos'
    console.error(err)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const cargarCategorias = async () => {
  try {
    const response = await api.get('categorias')
    categorias.value = response.data
  } catch (err) {
    console.error('Error al cargar categorías', err)
  }
}

// Versión con debounce para búsqueda en vivo
const buscarDebounced = debounce((): void => {
  resetearBusqueda()
  void cargarProductos()
}, 300)

// Watch para que al cambiar el término de búsqueda se haga la búsqueda con debounce
watch(terminoBusqueda, (): void => {
  buscarDebounced()
})

// También watcher para categoría para reiniciar y cargar productos
watch(categoriaSeleccionada, (): void => {
  resetearBusqueda()
  void cargarProductos()
})

// Detecta scroll al fondo
const handleScroll = (): void => {
  const scrollY = window.scrollY
  const viewportHeight = window.innerHeight
  const fullHeight = document.documentElement.scrollHeight

  if (scrollY + viewportHeight >= fullHeight - 200) {
    void cargarProductos()
  }
}

onMounted((): void => {
  void cargarCategorias()
  void cargarProductos()
  window.addEventListener('scroll', handleScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div>
    <h1>Lista de Productos</h1>
    <div v-if="loading && productos.length === 0">Cargando productos...</div>

    <div v-else>
      <div class="barra-filtros">
        <div class="grupo-busqueda">
          <label for="busqueda">Buscar producto:</label>
          <input id="busqueda" type="text" v-model="terminoBusqueda" @keyup.enter="buscar"
            placeholder="Escribe un nombre de producto..." />
          <div class="botones-busqueda">
            <!--<button @click="buscar">Buscar</button>-->
            <button class="limpiar" @click="limpiarBusqueda">Limpiar filtros</button>
          </div>
        </div>
        <div class="grupo-categoria">
          <label for="filtro-categoria">Filtrar por categoría:</label>
          <select id="filtro-categoria" v-model="categoriaSeleccionada">
            <option value="">Todas</option>
            <option v-for="cat in categorias" :key="cat.id" :value="cat.id">
              {{ cat.nombre }}
            </option>
          </select>
        </div>
      </div>
      <button @click="abrirModalProducto()" id="boton">Crear Producto</button>
      <CrearProducto :visible="mostrarModal" @close="cerrarModalProducto()" @productoCreado="productoCreado" />
      <button @click="abrirModalInventario()" id="boton">Agregar Inventario</button>
      <CrearInventario :show="mostrarInventarioModal" @close="cerrarModalInventario()" @creado="onInventarioCreado" />
      <table v-if="productos.length" class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Precio público</th>
            <th>Precio tapicero</th>
            <th>Precio compra</th>
            <th>Editar</th>
            <th>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="producto in productos" :key="producto.id">
            <td>{{ producto.nombre }}</td>
            <td>${{ producto.precio }}</td>
            <td>${{ producto.precio_tap }}</td>
            <td>${{ producto.precio_comp }}</td>
            <td><button @click="abrirEditModal(producto)" class="btn-editar">Editar</button></td>
            <td><button @click="eliminarProducto(producto.id)" class="btn-eliminar">Eliminar</button></td>
          </tr>
        </tbody>
      </table>

      <div v-else>
        <p>No hay productos disponibles en este momento.</p>
      </div>

      <div v-if="loadingMore">Cargando más productos...</div>
      <div v-if="!hasMore && productos.length">No hay más productos para mostrar.</div>
    </div>
    <UpdateProd :show="showEditModal" :producto="productoSeleccionado ?? {}" @close="cerrarEditModal"
      @updated="onProductoActualizado" />
  </div>
</template>

<style scoped>
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

.barra-filtros {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: flex-end;
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
}

.grupo-busqueda {
  flex: 1 1 300px;
  min-width: 250px;
}

.grupo-categoria {
  flex: 0 1 auto;
  min-width: 200px;
}

.grupo-busqueda {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.grupo-busqueda button {
  align-self: flex-start;
}

select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
  min-width: 250px;
}

.botones-busqueda {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

input[type="text"] {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 999px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  font-size: 1rem;
  width: 100%;
  max-width: 300px;
  outline: none;
  transition: box-shadow 0.2s ease;
}

input[type="text"]:focus {
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.3);
}

button {
  padding: 0.5rem 0.75rem;
  margin-top: 0.25rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  transition: background 0.2s ease;
}

button:hover {
  background-color: #0056b3;
}

/*button.limpiar {
  background-color: #6c757d;
}

button.limpiar:hover {
  background-color: #5a6268;
}*/

@media (min-width: 300px) and (min-width: 1000px) and (max-width: 1000px) {
  .barra-filtros {
    flex-direction: column;
    align-items: stretch;
  }

  select {
    width: 100%;
    max-width: 100%;
  }

  input[type="text"] {
    max-width: 95%;
  }

  .botones-busqueda {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
