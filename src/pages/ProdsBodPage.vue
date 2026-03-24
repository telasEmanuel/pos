<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import api from 'src/api/axios'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth';
import TransferInventoryModal from 'src/components/TransferInventoryModal.vue'
import EditarInventarioModal from 'src/components/EditarInventarioModal.vue'

interface Producto {
  id: number
  bodega_id: number
  producto?: {
    nombre: string
    categoria_id: number
    precio_comp?: number
  }
  categoria_id?: number
  categoriaId?: number
  rollos: number
  cantidad: number
  cantidad_piezas?: number
  medida_gru: string
  medida_ind: string
  precio_comp: number
  // New fields
  detalles?: Array<{
    cantidad: number
    estado: string
    id?: number
    seleccionado?: boolean
    [key: string]: unknown
  }>
  showDetails?: boolean
  rolosSeleccionados?: number[]
  cantidadTransferencia?: number
}

interface Categoria {
  id: number
  nombre: string
}

const props = defineProps({
  categoryId: {
    type: [String, Number],
    default: ''
  },
  technicalCard: {
    type: String,
    default: ''
  }
})

const $q = useQuasar()
const productos = ref<Producto[]>([])
const categoria = ref<Categoria | null>(null)
const categoriaSeleccionada = ref<string | number>('')
const loading = ref(false)
const datos = ref<{ rol?: string } | null>(null);
const authStore = useAuthStore();
const showTransferModal = ref(false)
const showEditModal = ref(false)
const existenciaSeleccionada = ref<Producto | null>(null)

const formatNumber = (val: number | string | undefined | null) => {
  if (val === null || val === undefined) return '0'
  return Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

const cargarProductos = async () => {
  loading.value = true
  try {
    const res = await api.get('inventarios')
    const items = (Array.isArray(res.data) ? res.data : (res.data.items ?? [])) as Producto[]

    console.log('📦 Inventarios cargados:', items) // DEBUG

    productos.value = items.map((p) => {
      const prodObj = p.producto || { precio_comp: 0 }
      const precioComp = Number(p.precio_comp ?? prodObj.precio_comp ?? 0)

      return {
        ...p,
        precio_comp: precioComp,
        showDetails: false,
        rolosSeleccionados: [],
        cantidadTransferencia: 0,
        detalles: p.detalles || []
      }
    })
  } catch (err) {
    console.error('Error cargando productos', err)
    productos.value = []
  } finally {
    loading.value = false
  }
}

const cargarCategoria = async () => {
  if (!props.categoryId) return
  try {
    const res = await api.get(`categorias/${props.categoryId}`)
    categoria.value = res.data
  } catch (err) {
    console.error('Error cargando categoría', err)
  }
}

const productosFiltrados = () => {
  if (!categoriaSeleccionada.value) return productos.value.filter(p => p.bodega_id === 2)
  const id = Number(categoriaSeleccionada.value)
  return productos.value.filter(p => {
    const catId = p.producto?.categoria_id ?? p.categoria_id ?? p.categoriaId
    return catId === id && p.bodega_id === 2
  })
}

const valorAlmacenado = () => {
  return productosFiltrados().reduce((total, prod) => {
    const precioComp = Number(prod.precio_comp || 0)
    const cantidad = Number(prod.cantidad || 0)
    return total + (precioComp * cantidad)
  }, 0)
}

const formatCurrency = (val: number) => {
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

// Productos seleccionados para transferencia
const productosSeleccionados = computed(() => {
  const resultado = []

  for (const prod of productosFiltrados()) {
    // OPCIÓN 1: Productos con rollos (cantidad_piezas > 0)
    if (Number(prod.cantidad_piezas) > 0 && prod.detalles && prod.detalles.length > 0) {
      // Obtener rollos seleccionados de este producto
      const rolosSeleccionados = prod.detalles
        .map((detalle, idx) => ({ detalle, idx }))
        .filter(({ idx }) => prod.rolosSeleccionados?.includes(idx))

      if (rolosSeleccionados.length === 0) continue

      // Calcular cantidad total de rollos seleccionados
      const cantidadTotal = rolosSeleccionados.reduce((sum, { detalle }) => {
        return sum + (Number(detalle.cantidad) || 0)
      }, 0)

      resultado.push({
        id: prod.id,
        producto_id: prod.id,
        bodega_id: prod.bodega_id,
        nombre: prod.producto?.nombre || 'Sin nombre',
        cantidadActual: prod.cantidad,
        cantidadTransferencia: cantidadTotal,
        medida_ind: prod.medida_ind,
        precio_comp: prod.precio_comp,
        rolesTransferencia: rolosSeleccionados
          .filter(({ detalle }) => detalle.id !== undefined)  // Solo incluir detalles con ID
          .map(({ detalle, idx }) => ({
            indice: idx,
            cantidad: detalle.cantidad,
            estado: detalle.estado,
            id: detalle.id as number  // El filtro anterior garantiza que id existe
          }))
      })
    }
    // OPCIÓN 2: Productos sin detalles - input simple
    else if ((prod.cantidadTransferencia ?? 0) > 0) {
      resultado.push({
        id: prod.id,
        producto_id: prod.id,
        bodega_id: prod.bodega_id,
        nombre: prod.producto?.nombre || 'Sin nombre',
        cantidadActual: prod.cantidad,
        cantidadTransferencia: prod.cantidadTransferencia ?? 0,
        medida_ind: prod.medida_ind,
        precio_comp: prod.precio_comp,
        rolesTransferencia: [] // Products without details don't have specific rollo info
      })
    }
  }

  return resultado
})

const totalProductosSeleccionados = computed(() => {
  return productosSeleccionados.value.reduce((total, p) => total + p.cantidadTransferencia, 0)
})

const toggleRollo = (producto: Producto, indiceRollo: number) => {
  if (!producto.rolosSeleccionados) {
    producto.rolosSeleccionados = []
  }

  const idx = producto.rolosSeleccionados.indexOf(indiceRollo)
  if (idx > -1) {
    producto.rolosSeleccionados.splice(idx, 1)
  } else {
    producto.rolosSeleccionados.push(indiceRollo)
  }
}

const estaRolloSeleccionado = (producto: Producto, indiceRollo: number) => {
  return producto.rolosSeleccionados?.includes(indiceRollo) ?? false
}

const abrirTransferencia = () => {
  if (productosSeleccionados.value.length === 0) {
    alert('Por favor selecciona productos para transferir')
    return
  }
  showTransferModal.value = true
}

const cerrarTransferencia = () => {
  showTransferModal.value = false
}

const abrirEditModal = (existencia: Producto) => {
  existenciaSeleccionada.value = existencia
  showEditModal.value = true
}

const cerrarEditModal = () => {
  showEditModal.value = false
  existenciaSeleccionada.value = null
}

const onInventarioActualizado = () => {
  $q.notify({
    message: 'Inventario actualizado exitosamente',
    color: 'positive',
    icon: 'check_circle',
    position: 'top',
  })
  void recargarDatos()
}

const eliminarInventario = async (id: number) => {
  if (!confirm('¿Estás seguro de que quieres eliminar este inventario?')) {
    return
  }

  try {
    await api.delete(`inventarios/${id}`)
    $q.notify({
      message: 'Inventario eliminado correctamente',
      color: 'positive',
      icon: 'check_circle',
      position: 'top',
    })
    void recargarDatos()
  } catch (err) {
    console.error('Error al eliminar inventario:', err)
    $q.notify({
      message: 'Error al eliminar el inventario',
      color: 'negative',
      icon: 'error',
      position: 'top',
    })
  }
}

const recargarDatos = async () => {
  // Limpiar selecciones
  productos.value.forEach(p => {
    p.rolosSeleccionados = []
    p.cantidadTransferencia = 0
    p.showDetails = false
  })
  await cargarProductos()
}

onMounted(() => {
  datos.value = authStore.user;
  if (props.categoryId) {
    categoriaSeleccionada.value = props.categoryId
  }
  void cargarCategoria()
  void cargarProductos()
  datos.value = authStore.user;
})

watch(() => props.categoryId, (newVal) => {
  if (newVal) {
    categoriaSeleccionada.value = newVal
  }
})
</script>

<template>
  <!--<div v-if="loading" class="loading">
    <div class="spinner"></div>
    <p>Cargando pedidos...</p>
  </div>-->

  <main class="home-page">
    <nav class="breadcrumb">
      <!--<router-link to="/select" class="breadcrumb-item">Inicio</router-link>
      <span class="breadcrumb-separator">/</span>-->
      <router-link to="/bodega" class="breadcrumb-item">Categorías Bodega</router-link>
      <span class="breadcrumb-separator">/</span>
      <span class="breadcrumb-current">{{ categoria?.nombre || 'Cargando...' }}</span>
    </nav>
    <div v-if="props.technicalCard" class="descripcion-container">
      <p class="descripcion">{{ props.technicalCard }}</p>
    </div>

    <!-- Valor Almacenado -->
    <div class="valor-almacenado-container" v-if="datos?.rol === 'visor'">
      <div class="valor-almacenado-card">
        <div class="valor-content">
          <p class="valor-label">Valor Almacenado</p>
          <p class="valor-amount">{{ formatCurrency(valorAlmacenado()) }}</p>
        </div>
      </div>
    </div>

    <section>
      <h1 class="main-title">Productos</h1>
      <div v-if="loading">Cargando productos...</div>
      <div v-else>
        <section v-if="productosFiltrados().length" class="actions">
          <div v-for="prod in productosFiltrados()" :key="prod.id" class="card">
            <div class="card-header">
              <h3>{{ prod.producto?.nombre }}</h3>
            </div>

            <div class="card-body">
              <!-- Badge for Rolls/Group Measure -->
              <!-- <div v-if="prod.rollos > 0 || prod.medida_gru" class="badge-group"> -->
              <div v-if="prod.medida_gru !== prod.medida_ind" class="badge-group">
                <span class="badge-icon">📦</span>
                <span class="badge-text">{{ formatNumber(prod.rollos) }} {{ prod.medida_gru }}</span>
              </div>

              <!-- Main Quantity Display -->
              <div class="stat-main">
                <span class="stat-value">{{ formatNumber(prod.cantidad) }}</span>
                <span class="stat-unit">{{ prod.medida_ind }}</span>
              </div>

              <!-- Solo mostrar opciones si cantidad > 0 -->
              <div v-if="Number(prod.cantidad) > 0">
                <!-- Rollos/Detalles Section (producto CON cantidad_piezas) -->
                <div v-if="Number(prod.cantidad_piezas) > 0" class="rollos-section">
                  <button class="btn-toggle-detalles" @click="prod.showDetails = !prod.showDetails">
                    <span class="toggle-icon">{{ prod.showDetails ? '▼' : '▶' }}</span>
                    <span class="toggle-text">
                      {{ prod.rollos }} {{ prod.medida_gru }}
                      <span v-if="prod.rolosSeleccionados?.length" class="selected-count">
                        ({{ prod.rolosSeleccionados.length }} seleccionado{{ prod.rolosSeleccionados.length > 1 ? 's' :
                          '' }})
                      </span>
                    </span>
                  </button>

                  <!-- Rollos Seleccionables -->
                  <div v-if="prod.showDetails" class="rollos-list">
                    <div v-for="(rollo, idx) in prod.detalles" :key="idx" class="rollo-item"
                      :class="{ selected: estaRolloSeleccionado(prod, idx) }">
                      <input type="checkbox" :id="`rollo-${prod.id}-${idx}`" :checked="estaRolloSeleccionado(prod, idx)"
                        @change="toggleRollo(prod, idx)" class="rollo-checkbox" />
                      <label :for="`rollo-${prod.id}-${idx}`" class="rollo-label">
                        <div class="rollo-info-main">
                          <span class="rollo-num">Rollo #{{ idx + 1 }}</span>
                          <!-- <span class="rollo-qty"></span> -->
                        </div>
                        <div class="rollo-info-secondary">
                          <span class="rollo-conversion">{{ formatNumber(rollo.cantidad) }} {{ prod.medida_ind }}</span>
                          <span class="rollo-status" :class="'status-' + rollo.estado.toLowerCase()">
                            {{ rollo.estado }}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Simple Input for Products WITHOUT Detalles -->
                <div v-else class="input-simple-section">
                  <label class="input-simple-label">🚚 Cantidad a transferir:</label>
                  <div class="input-simple-group">
                    <input v-model.number="prod.cantidadTransferencia" type="number" min="0"
                      :max="Number(prod.cantidad)" class="input-simple" @input="(e: Event) => {
                        const target = e.target as HTMLInputElement;
                        let val = Number(target.value) || 0;
                        if (val > Number(prod.cantidad)) prod.cantidadTransferencia = Number(prod.cantidad);
                        if (val < 0) prod.cantidadTransferencia = 0;
                      }" placeholder="0" />
                    <span class="input-simple-unit">{{ prod.medida_ind }}</span>
                  </div>
                  <div v-if="(prod.cantidadTransferencia ?? 0) > 0" class="input-simple-preview">
                    <small>Transferirá: <strong>{{ formatNumber(prod.cantidadTransferencia) }}</strong> {{
                      prod.medida_ind }}</small>
                  </div>
                </div>
                <!-- Fin: Solo mostrar opciones si cantidad > 0 -->
              </div>

              <!-- Toggle Details -->
              <div class="card-footer" v-if="prod.detalles && prod.detalles.length">
                <!-- Details shown above in rollos-section -->
              </div>

              <!-- Action Buttons (Editar y Eliminar) -->
              <div class="card-actions" v-if="datos?.rol === 'visor'">
                <button @click="abrirEditModal(prod)" class="btn-editar">Editar</button>
                <button @click="eliminarInventario(prod.id)" class="btn-eliminar">Eliminar</button>
              </div>
            </div>
          </div>
        </section>
        <div v-else>No hay productos para la categoría seleccionada.</div>
      </div>
    </section>

    <!-- Floating Transfer Button -->
    <div v-if="totalProductosSeleccionados > 0" class="floating-transfer-btn">
      <button @click="abrirTransferencia" class="btn-transfer-floating">
        <span class="transfer-icon">🚚</span>
        <span class="transfer-count">{{ totalProductosSeleccionados }}</span>
        <span class="transfer-label">Transferir</span>
      </button>
    </div>
  </main>

  <!-- Transfer Modal -->
  <TransferInventoryModal :show="showTransferModal" :productos="productosSeleccionados" @close="cerrarTransferencia"
    @success="recargarDatos" />

  <!-- Modal de Edición de Inventario -->
  <EditarInventarioModal v-if="existenciaSeleccionada" :show="showEditModal" :existencia="existenciaSeleccionada"
    @close="cerrarEditModal" @updated="onInventarioActualizado" />
</template>

<style scoped>
.main-title {
  text-align: center;
  margin-top: 2rem;
  margin-bottom: 3rem;
  font-size: 2.5rem;
  color: #1a202c;
  font-weight: 800;
  letter-spacing: -0.025em;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
}

.card {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
  padding: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.8);
  position: relative;
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-color: #bfdbfe;
}

/* Decorative top bar */
.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(135deg, #ffd54f 0%, #8b5e3c 100%);
}

.card-header {
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;
}

.card-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.4;
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
  justify-content: center;
}

.badge-group {
  background-color: #fff;
  color: #64748b;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #dbeafe;
}

.badge-icon {
  font-size: 1.1rem;
}

.stat-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-value {
  font-size: 3rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
  letter-spacing: -2px;
}

.stat-unit {
  font-size: 1rem;
  color: #64748b;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 0.25rem;
}

.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  padding-bottom: 4rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 2rem;
  font-size: 0.95rem;
  color: #64748b;
}

.breadcrumb-item {
  color: #64748b;
  text-decoration: none;
  transition: color 0.2s;
  font-weight: 500;
}

.breadcrumb-item:hover {
  color: #3b82f6;
}

.breadcrumb-separator {
  color: #cbd5e1;
}

.breadcrumb-current {
  color: #0f172a;
  font-weight: 600;
}

@media (max-width: 640px) {
  .actions {
    grid-template-columns: 1fr;
  }

  .main-title {
    font-size: 2rem;
  }
}

.card-footer {
  margin-top: 1rem;
  width: 100%;
}

.btn-details {
  background: #fff;
  border: 1px solid #cce2ff;
  color: #64748b;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}

.btn-details:hover {
  background: #f8fafc;
  color: #64748baf;
  border-color: #bfdbfe;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  margin-top: 1rem;
}

.btn-editar {
  background: linear-gradient(135deg, #ffd54f 0%, #8b5e3c 100%);
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}

.btn-editar:hover {
  background: linear-gradient(135deg, #ffdd77 0%, #a0744a 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 213, 79, 0.4);
}

.btn-eliminar {
  background: #dc2626;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}

.btn-eliminar:hover {
  background: #b91c1c;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.details-list {
  margin-top: 1rem;
  width: 100%;
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.5rem;
  text-align: left;
  max-height: 150px;
  overflow-y: auto;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.85rem;
  color: #475569;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-idx {
  color: #94a3b8;
  font-size: 0.75rem;
  width: 25px;
}

.detail-val {
  font-weight: 600;
  flex: 1;
}

.detail-status {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.detail-status.disponible {
  background: #dcfce7;
  color: #166534;
}

.descripcion-container {
  text-align: center;
  padding: 1.5rem 2rem;
  background: rgba(255, 255, 255, 0.8);
  margin: 0 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.descripcion {
  font-size: 1.1rem;
  color: #555;
  margin: 0;
  line-height: 1.6;
}

.valor-almacenado-container {
  display: flex;
  justify-content: center;
  padding: 2rem 2rem 1rem;
}

.valor-almacenado-card {
  background: linear-gradient(135deg, #FFD54F 0%, #8B5E3C 100%);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(255, 213, 79, 0.3);
  padding: 2rem 3rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-width: 350px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.valor-almacenado-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(255, 213, 79, 0.4);
}

.valor-icon {
  font-size: 3rem;
  background: rgba(74, 46, 26, 0.3);
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  backdrop-filter: blur(10px);
}

.valor-content {
  flex: 1;
}

.valor-label {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.valor-amount {
  margin: 0.5rem 0 0;
  font-size: 2.5rem;
  color: #ffffff;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1px;
}

/* Transfer Section Styles */
.transfer-section {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-radius: 12px;
  border: 2px solid #667eea30;
}

.transfer-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: #d9a441;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.transfer-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.transfer-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #d9a441;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: #d9a441;
  background: white;
  transition: all 0.2s;
}

.transfer-input:focus {
  outline: none;
  border-color: #c2923a;
  box-shadow: 0 0 0 3px rgba(217, 164, 65, 0.1);
}

.transfer-input::placeholder {
  color: #cbd5e1;
}

.transfer-unit {
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
  min-width: 50px;
}

/* Rollos Section Styles */
.rollos-section {
  width: 100%;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  border-radius: 12px;
  overflow: hidden;
}

.btn-toggle-detalles {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #d9a441 0%, #8b5e3c 100%);
  color: white;
  border: none;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.btn-toggle-detalles:hover {
  box-shadow: inset 0 -2px 4px rgba(0, 0, 0, 0.1);
}

.toggle-icon {
  font-size: 0.8rem;
  transition: transform 0.2s;
}

.toggle-text {
  flex: 1;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.selected-count {
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.25);
  padding: 0.25rem 0.5rem;
  border-radius: 20px;
  margin-left: auto;
}

.rollos-list {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.rollo-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;
}

.rollo-item:hover {
  border-color: #d9a441;
  background: #f8f9fc;
}

.rollo-item.selected {
  border-color: #d9a441;
  background: #f0f4ff;
}

.rollo-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: #d9a441;
  flex-shrink: 0;
}

.rollo-label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  cursor: pointer;
  margin-left: 0.75rem;
  font-size: 0.95rem;
}

.rollo-info-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rollo-num {
  font-weight: 700;
  color: #1e293b;
  min-width: 70px;
}

.rollo-qty {
  font-weight: 600;
  color: #d9a441;
  min-width: 100px;
}

.rollo-info-secondary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.rollo-conversion {
  color: #64748b;
  font-style: italic;
  font-weight: 500;
  flex: 1;
}

.rollo-status {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rollo-status.status-disponible {
  background: #dcfce7;
  color: #166534;
}

.rollo-status.status-reservado {
  background: #fef3c7;
  color: #92400e;
}

.rollo-status.status-defectuoso {
  background: #fee2e2;
  color: #991b1b;
}

/* Input Simple Section Styles */
.input-simple-section {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  border-radius: 12px;
  border: 2px solid #667eea30;
}

.input-simple-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: #d9a441;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.input-simple-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;

}

.input-simple {
  flex: 1;
  padding: 0.875rem;
  border: 2px solid #d9a441;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  color: #e7b65b;
  background: white;
  transition: all 0.2s;
}

.input-simple:focus {
  outline: none;
  border-color: #966406;
}

.input-simple::placeholder {
  color: #cbd5e1;
}

.input-simple-unit {
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
  min-width: 60px;
}

.input-simple-preview {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #dbeafe;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #0c4a6e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-simple-preview strong {
  color: #667eea;
  font-weight: 700;
}

/* Floating Transfer Button */
.floating-transfer-btn {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 100;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.btn-transfer-floating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #d9a441 0%, #8b5e3c 100%);
  color: white;
  border: none;
  border-radius: 16px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(217, 164, 65, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  min-width: 140px;
}

.btn-transfer-floating:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 40px rgba(217, 164, 65, 0.6);
}

.btn-transfer-floating:active {
  transform: translateY(-2px);
}

.transfer-icon {
  font-size: 1.5rem;
}

.transfer-count {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ff4757;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(255, 71, 87, 0.4);
}

@media (max-width: 768px) {
  .floating-transfer-btn {
    bottom: 1rem;
    right: 1rem;
  }

  .btn-transfer-floating {
    padding: 0.875rem 1rem;
    min-width: 130px;
  }

  .transfer-input {
    padding: 0.6rem;
    font-size: 0.95rem;
  }
}
</style>
