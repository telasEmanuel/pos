<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api from 'src/api/axios'
import AgregarDetalleInventario from 'src/components/AgregarDetalleInventario.vue'

interface InventarioDetalle {
  id: number
  inventario_id: number
  cantidad: number | string
  estado: string
  codigo?: string
}

interface Inventario {
  id: number
  producto_id: number
  bodega_id: number
  cantidad: number | string
  rollos: number | string
  medida_ind: string
  medida_gru: string
  detalles: InventarioDetalle[]
  producto?: {
    id: number
    nombre: string
    descripcion?: string
    precio_comp?: number | string
  }
  bodega?: {
    id: number
    nombre: string
  }
  showDetails?: boolean
}

const inventarios = ref<Inventario[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filtroProducto = ref('')
const mostrarModalAgregar = ref(false)
const inventarioSeleccionado = ref<Inventario | null>(null)

const inventariosFilterados = computed(() => {
  if (!filtroProducto.value) return inventarios.value
  return inventarios.value.filter(inv =>
    inv.producto?.nombre.toLowerCase().includes(filtroProducto.value.toLowerCase())
  )
})

const cargarInventarios = async () => {
  try {
    loading.value = true
    const response = await api.get('inventarios')
    const data = Array.isArray(response.data) ? response.data : response.data.items || []

    inventarios.value = data.map((inv: Record<string, unknown>) => {
      const inventario = inv as unknown as Inventario
      return {
        ...inventario,
        detalles: Array.isArray(inventario.detalles) ? inventario.detalles : [],
        showDetails: false
      }
    })
    error.value = null
  } catch (err) {
    console.error('Error al cargar inventarios:', err)
    error.value = 'Error al obtener los inventarios'
  } finally {
    loading.value = false
  }
}

const alternarDetalles = (inventario: Inventario) => {
  inventario.showDetails = !inventario.showDetails
}

const actualizarDetalle = async (inventario: Inventario, detalleIdx: number, nuevoDetalle: InventarioDetalle) => {
  try {
    // Llamar al API para actualizar
    await api.put(`inventarios/detalles/${nuevoDetalle.id}`, {
      cantidad: nuevoDetalle.cantidad,
      estado: nuevoDetalle.estado,
      codigo: nuevoDetalle.codigo
    })

    // Actualizar localmente
    if (inventario?.detalles) {
      inventario.detalles[detalleIdx] = nuevoDetalle
      // Recalcular el total después de actualizar
      inventario.cantidad = obtenerTotalMetros(inventario.detalles)
    }
  } catch (err) {
    console.error('Error al actualizar detalle:', err)
    alert('Error al actualizar el detalle')
    // Recargar para sincronizar
    await cargarInventarios()
  }
}

const eliminarDetalle = async (inventario: Inventario, detalleId: number) => {
  if (!confirm('¿Estás seguro de que deseas eliminar este detalle?')) return

  try {
    await api.delete(`inventarios/detalles/${detalleId}`)
    if (inventario?.detalles) {
      inventario.detalles = inventario.detalles.filter(
        d => d.id !== detalleId
      )
    }
  } catch (err) {
    console.error('Error al eliminar detalle:', err)
    alert('Error al eliminar el detalle')
  }
}

const obtenerTotalMetros = (detalles: InventarioDetalle[] | undefined): number => {
  try {
    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      return 0
    }
    const total = detalles.reduce((sum: number, d: InventarioDetalle) => {
      const cantidad = typeof d.cantidad === 'number'
        ? d.cantidad
        : parseFloat(String(d.cantidad)) || 0
      return sum + cantidad
    }, 0)
    return Number.isFinite(total) ? total : 0
  } catch {
    return 0
  }
}

const abrirModalAgregarDetalle = (inventario: Inventario) => {
  inventarioSeleccionado.value = inventario
  mostrarModalAgregar.value = true
}

const cerrarModalAgregarDetalle = () => {
  mostrarModalAgregar.value = false
  inventarioSeleccionado.value = null
}

const detalleCreado = async () => {
  cerrarModalAgregarDetalle()
  // Recargar los inventarios para actualizar los detalles
  await cargarInventarios()
}

onMounted(() => {
  void cargarInventarios()
})
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>Detalles de Inventario</h1>
      <button @click="cargarInventarios" class="btn-recargar">🔄 Recargar</button>
    </div>

    <div v-if="loading" class="loading">
      <p>Cargando inventarios...</p>
    </div>

    <div v-else>
      <!-- Filtro de búsqueda -->
      <div class="filtro-container">
        <input v-model="filtroProducto" type="text" placeholder="Filtrar por nombre del producto..."
          class="filtro-input" />
      </div>

      <!-- Mostrar errores -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Lista de inventarios con detalles expandibles -->
      <div v-if="inventariosFilterados.length" class="inventarios-list">
        <div v-for="inventario in inventariosFilterados" :key="inventario.id" class="inventario-card">
          <!-- Header del inventario (clickeable para expandir) -->
          <div class="inventario-header" @click="alternarDetalles(inventario)">
            <div class="inventario-info">
              <h3>{{ inventario.producto?.nombre || 'Producto sin nombre' }}</h3>
              <div class="inventario-meta">
                <span class="meta-item">
                  <strong>Bodega:</strong> {{ inventario.bodega?.nombre || 'N/A' }}
                </span>
                <span class="meta-item">
                  <strong>Total {{ inventario.medida_gru }}:</strong> {{ inventario.rollos }}
                </span>
                <span class="meta-item">
                  <strong>Total {{ inventario.medida_ind }}:</strong>
                  {{ obtenerTotalMetros(inventario.detalles).toFixed(2) }}
                </span>
              </div>
            </div>
            <div class="toggle-icon">
              {{ inventario.showDetails ? '▼' : '▶' }}
            </div>
          </div>

          <!-- Detalles expandidos -->
          <div v-show="inventario.showDetails" class="detalles-expandidos">
            <div class="detalles-header">
              <button @click="abrirModalAgregarDetalle(inventario)" class="btn-agregar-rollo">
                ➕ Agregar {{ inventario.medida_ind }}
              </button>
            </div>

            <table v-if="inventario.detalles && inventario.detalles.length" class="detalles-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cantidad ({{ inventario.medida_ind }})</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(detalle, detalleIdx) in inventario.detalles" :key="detalle.id">
                  <td>{{ detalle.codigo || 'N/A' }}</td>
                  <td>
                    <input :value="detalle.cantidad" type="number" step="0.01"
                      @change="(e: Event) => actualizarDetalle(inventario, detalleIdx, { ...detalle, cantidad: parseFloat((e.target as HTMLInputElement).value) })"
                      class="input-cantidad" />
                  </td>
                  <td>
                    <span class="estado-badge" :class="`estado-${detalle.estado?.toLowerCase()}`">
                      {{ detalle.estado || 'DISPONIBLE' }}
                    </span>
                  </td>
                  <td class="acciones">
                    <button @click="eliminarDetalle(inventario, detalle.id)" class="btn-eliminar"
                      title="Eliminar detalle">
                      🗑️
                    </button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="1"><strong>Total</strong></td>
                  <td><strong>{{ obtenerTotalMetros(inventario.detalles).toFixed(2) }} {{ inventario.medida_ind
                      }}</strong></td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>

            <div v-else class="sin-detalles">
              <p>✨ No hay rollos registrados para este inventario</p>
              <p class="hint">Haz clic en "Agregar Rollo" para crear el primer detalle</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="no-data">
        <p>No hay inventarios disponibles</p>
      </div>
    </div>

    <!-- Modal para agregar detalle -->
    <AgregarDetalleInventario :visible="mostrarModalAgregar" :inventario-id="inventarioSeleccionado?.id || 0"
      :medida-ind="inventarioSeleccionado?.medida_ind || ''" @close="cerrarModalAgregarDetalle"
      @detalle-creado="detalleCreado" />
  </div>
</template>

<style scoped>
.container {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

h1 {
  color: #333;
  font-size: 1.8rem;
  margin: 0;
}

.btn-recargar {
  background: #4f8cff;
  color: white;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-recargar:hover {
  background: #2563eb;
  transform: translateY(-2px);
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  border-left: 4px solid #c33;
}

.filtro-container {
  margin-bottom: 2rem;
}

.filtro-input {
  width: 100%;
  max-width: 400px;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.filtro-input:focus {
  outline: none;
  border-color: #4f8cff;
  box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
}

.inventarios-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(600px, 1fr));
  gap: 1.5rem;
}

.inventario-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.inventario-header {
  padding: 1.5rem;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s ease;
}

.inventario-header:hover {
  background: #f0f2f5;
}

.inventario-info {
  flex: 1;
}

.inventario-info h3 {
  margin: 0 0 0.75rem 0;
  color: #333;
  font-size: 1.1rem;
}

.inventario-meta {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 0.9rem;
  color: #666;
}

.meta-item strong {
  color: #333;
}

.toggle-icon {
  font-size: 1.2rem;
  color: #4f8cff;
  transition: transform 0.2s ease;
}

.detalles-expandidos {
  padding: 1.5rem;
  background: #fff;
}

.detalles-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.detalles-table th,
.detalles-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.detalles-table th {
  background-color: #f5f5f5;
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.detalles-table tbody tr:hover {
  background-color: #f9f9f9;
}

.input-cantidad {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.input-cantidad:focus {
  outline: none;
  border-color: #4f8cff;
  box-shadow: 0 0 0 2px rgba(79, 140, 255, 0.1);
}

.estado-badge {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
}

.estado-disponible {
  background: #e8f5e9;
  color: #388e3c;
}

.estado-reservado {
  background: #fff3e0;
  color: #f57c00;
}

.estado-dañado {
  background: #ffebee;
  color: #c62828;
}

.acciones {
  text-align: center;
}

.btn-eliminar {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.btn-eliminar:hover {
  background: #ffebee;
}

.total-row {
  background: #f5f5f5;
  font-weight: 600;
}

.total-row td {
  padding: 1rem 0.75rem;
  border-top: 2px solid #ddd;
}

.sin-detalles,
.no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
  background: #f9f9f9;
  border-radius: 6px;
}

.sin-detalles .hint {
  font-size: 0.85rem;
  color: #999;
  margin: 0.5rem 0 0 0;
}

.detalles-header {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.btn-agregar-rollo {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-agregar-rollo:hover {
  background: #059669;
  transform: translateY(-2px);
}

.btn-agregar-rollo:active {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-recargar {
    width: 100%;
  }

  h1 {
    font-size: 1.5rem;
  }

  .inventarios-list {
    grid-template-columns: 1fr;
  }

  .inventario-header {
    padding: 1rem;
  }

  .inventario-meta {
    flex-direction: column;
    gap: 0.5rem;
  }

  .detalles-table {
    font-size: 0.85rem;
  }

  .detalles-table th,
  .detalles-table td {
    padding: 0.5rem;
  }
}
</style>
