<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import api from 'src/api/axios'
import { useQuasar } from 'quasar'

interface Producto {
  id: number
  nombre: string
  precio?: number | string
}

interface Props {
  show: boolean
  precioCompra: number
  precioTapicero: number
  precioPublico: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  confirmar: [ids: number[]]
}>()

const $q = useQuasar()
const productos = ref<Producto[]>([])
const productosFiltrados = ref<Producto[]>([])
const busqueda = ref('')
const productosSeleccionados = ref<Set<number>>(new Set())
const cargando = ref(false)
const actualizando = ref(false)

// Cargar productos
const cargarProductos = async () => {
  try {
    cargando.value = true
    console.log('📡 Llamando a GET /productos/all')
    const response = await api.get('productos/all')
    console.log('✅ Respuesta del servidor:', response.data)

    // Asegurarse de que es un array
    if (Array.isArray(response.data)) {
      productos.value = response.data
    } else if (response.data && typeof response.data === 'object') {
      // Si es un objeto, convertir a array
      productos.value = Object.values(response.data)
    } else {
      console.warn('⚠️ Respuesta inesperada:', response.data)
      productos.value = []
    }

    console.log(`📦 ${productos.value.length} productos cargados`)
    productosFiltrados.value = productos.value
  } catch (error) {
    console.error('❌ Error al cargar productos:', error)
    $q.notify({
      type: 'negative',
      message: 'Error al cargar productos',
      position: 'top'
    })
  } finally {
    cargando.value = false
  }
}

// Filtrar productos según búsqueda
const filtrarProductos = () => {
  if (!busqueda.value.trim()) {
    productosFiltrados.value = productos.value
  } else {
    const termino = busqueda.value.toLowerCase()
    productosFiltrados.value = productos.value.filter(p =>
      p.nombre?.toLowerCase().includes(termino)
    )
  }
}

// Toggle selección de producto
const toggleProducto = (id: number) => {
  if (productosSeleccionados.value.has(id)) {
    productosSeleccionados.value.delete(id)
  } else {
    productosSeleccionados.value.add(id)
  }
}

// Seleccionar/Deseleccionar todos los filtrados
const toggleTodos = () => {
  const idsVisibles = productosFiltrados.value.map(p => p.id)
  const todosSeleccionados = idsVisibles.every(id => productosSeleccionados.value.has(id))

  if (todosSeleccionados) {
    idsVisibles.forEach(id => productosSeleccionados.value.delete(id))
  } else {
    idsVisibles.forEach(id => productosSeleccionados.value.add(id))
  }
}

// Confirmar actualización
const confirmar = async () => {
  if (productosSeleccionados.value.size === 0) {
    $q.notify({
      type: 'warning',
      message: 'Selecciona al menos un producto',
      position: 'top'
    })
    return
  }

  try {
    actualizando.value = true
    const ids = Array.from(productosSeleccionados.value)

    await api.put('productos/batch-update', {
      ids,
      precio_comp: props.precioCompra,
      precio_tap: props.precioTapicero,
      precio: props.precioPublico
    })

    $q.notify({
      type: 'positive',
      message: `${ids.length} producto(s) actualizado(s) exitosamente`,
      position: 'top'
    })

    cerrar()
  } catch (error) {
    console.error('Error al actualizar precios:', error)
    $q.notify({
      type: 'negative',
      message: 'Error al actualizar los precios',
      position: 'top'
    })
  } finally {
    actualizando.value = false
  }
}

const cerrar = () => {
  busqueda.value = ''
  productosSeleccionados.value.clear()
  emit('close')
}

// Contador de seleccionados
const countSeleccionados = computed(() => productosSeleccionados.value.size)
const countVisibles = computed(() => productosFiltrados.value.length)

// Cargar productos cuando el modal se abre
watch(
  () => props.show,
  async (newVal) => {
    if (newVal) {
      console.log('🔍 Modal abierto, cargando productos...')
      await cargarProductos()
    }
  }
)
</script>

<template>
  <q-dialog :model-value="show" @update:model-value="emit('close')" persistent>
    <q-card style="min-width: 600px; max-width: 700px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Cambio de precios de varios productos</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="cerrar" />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 q-mb-md">
          <div>Precios a aplicar:</div>
          <div style="margin-top: 0.5rem; font-size: 0.9rem;">
            <div>• Precio de compra: <strong>${{ precioCompra.toFixed(2) }}</strong></div>
            <div>• Precio al tapicero: <strong>${{ precioTapicero.toFixed(2) }}</strong></div>
            <div>• Precio público: <strong>${{ precioPublico.toFixed(2) }}</strong></div>
          </div>
        </div>

        <!-- Barra de búsqueda -->
        <div class="q-mb-md">
          <q-input v-model="busqueda" @update:model-value="filtrarProductos" outlined dense
            placeholder="Buscar productos..." clearable class="full-width" />
        </div>

        <!-- Selector todos los filtrados -->
        <div class="q-mb-md row items-center q-gutter-sm">
          <q-checkbox :model-value="productosFiltrados.every(p => productosSeleccionados.has(p.id))"
            @update:model-value="toggleTodos" label="Seleccionar todos"
            :disable="cargando || productosFiltrados.length === 0" />
          <span class="text-caption">
            {{ countSeleccionados }} de {{ countVisibles }} seleccionados
          </span>
        </div>

        <!-- Lista de productos -->
        <div class="productos-list" style="max-height: 300px; overflow-y: auto">
          <div v-if="cargando" class="text-center q-py-md">
            <q-spinner color="primary" size="40px" />
          </div>

          <div v-else-if="productosFiltrados.length === 0" class="text-center q-py-md text-grey">
            No hay productos para mostrar
          </div>

          <div v-else>
            <div v-for="producto in productosFiltrados" :key="producto.id" class="producto-item q-pa-sm q-mb-xs">
              <q-checkbox :model-value="productosSeleccionados.has(producto.id)"
                @update:model-value="toggleProducto(producto.id)" class="full-width">
                <div class="column items-start justify-between full-width q-pl-sm">
                  <span style="margin-bottom: 0.25rem;">{{ producto.nombre }}</span>
                  <span class="text-caption text-grey">
                    Precio actual: ${{ parseFloat(String(producto.precio || 0)).toFixed(2) }}
                  </span>
                </div>
              </q-checkbox>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat label="Cancelar" color="primary" @click="cerrar" :disable="actualizando" />
        <q-btn unelevated label="Aplicar cambios" color="positive" @click="confirmar" :loading="actualizando"
          :disable="productosSeleccionados.size === 0 || cargando" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.productos-list {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem;
  background: #f9fafb;
}

.producto-item {
  border-radius: 6px;
  background: #fff;
  border: 1px solid #f3f4f6;
  transition: all 0.2s;
}

.producto-item:hover {
  border-color: var(--color-brand-primary);
  background: #fffbf0;
}
</style>
