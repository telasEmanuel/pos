<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import api from '../api/axios'
import logo from '../assets/logoT.png'
import { generateOrderPDF } from '../utils/pdfGenerator'

type DetalleOrden = {
  producto_id: number | null
  cantidad: number
  rollos: number
  precio_unitario: number
  busqueda: string
  mostrarSugerencias: boolean
  productoSeleccionado: { id: number; nombre: string } | null
  tipoEntrada: string
  cantidadRollosInput: number
  detallesRollos: number[]
}

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'created'])
const productos = ref<Array<{ id: number; nombre: string; precio: number; descripcion?: string }>>([])
const inventarios = ref<Array<{ id: number; producto_id: number; bodega_id: number;[key: string]: unknown }>>([])
const proveedores = ref<Array<{ id: number; nombre: string; contacto: string;[key: string]: unknown }>>([])
const proveedor_id = ref<number | null>(null)
const estado = ref<string>('pendiente')

const detalles = ref<DetalleOrden[]>([
  {
    producto_id: null,
    cantidad: 1,
    rollos: 0,
    precio_unitario: 0,
    busqueda: '',
    mostrarSugerencias: false,
    productoSeleccionado: null,
    tipoEntrada: 'estandar',
    cantidadRollosInput: 0,
    detallesRollos: [0]
  }
])

const error = ref<string>('')
const success = ref<boolean>(false)

function addDetalle(): void {
  const nuevoDetalle: DetalleOrden = {
    producto_id: null,
    cantidad: 1,
    rollos: 0,
    precio_unitario: 0,
    busqueda: '',
    mostrarSugerencias: false,
    productoSeleccionado: null,
    tipoEntrada: 'estandar',
    cantidadRollosInput: 0,
    detallesRollos: [0]
  }
  detalles.value.push(nuevoDetalle)
}

function removeDetalle(index: number): void {
  detalles.value.splice(index, 1)
}

function getProcessedDetalles(): Array<{ producto_id: number | null; cantidad: number; rollos: number; precio_unitario: number; tipo: string; measurements: number[] }> {
  const map = new Map()

  detalles.value.forEach((d: DetalleOrden) => {
    if (!d.producto_id) return

    const key = `${d.producto_id}_${d.tipoEntrada}`
    if (!map.has(key)) {
      map.set(key, {
        producto_id: d.producto_id,
        cantidad: 0,
        rollos: 0,
        precio_unitario: d.precio_unitario,
        tipo: d.tipoEntrada,
        measurements: []
      })
    }

    const item = map.get(key)
    if (d.tipoEntrada === 'rollos') {
      // Para rollos, contar cada uno y agregar a measurements (incluso los 0)
      d.detallesRollos.forEach((metros: number) => {
        const val = Number(metros)
        item.rollos += 1
        item.measurements.push(val)
      })
    } else {
      // Para estandar, sumar la cantidad
      item.cantidad += Number(d.cantidad)
    }
  })

  return Array.from(map.values())
}

async function submitOrder(): Promise<void> {
  error.value = ''
  success.value = false

  const processedDetalles = getProcessedDetalles()

  const hasSelectedProducts = detalles.value.some((d: DetalleOrden) => d.producto_id !== null)

  if (!proveedor_id.value) {
    error.value = 'El proveedor es requerido'
    return
  }

  if (!hasSelectedProducts) {
    error.value = 'Debe seleccionar al menos un producto'
    return
  }

  try {
    const payloadToSend = {
      proveedor_id: proveedor_id.value,
      estado: estado.value,
      detalles: processedDetalles
        .filter((d) => d.producto_id !== null)
        .map(d => ({
          producto_id: d.producto_id,
          cantidad: d.cantidad,
          rollos: d.rollos,
          precio_unitario: d.precio_unitario,
          tipo: d.tipo,
          measurements: d.measurements
        }))
    } as const

    const response = await api.post('ordenes', payloadToSend)
    const ordenId = response.data?.orden?.id

    // Guardar metadata de rollos para poder recuperarlos después
    if (ordenId) {
      const rollosData = detalles.value
        .filter((d: DetalleOrden) => d.tipoEntrada === 'rollos' && d.producto_id)
        .map((d: DetalleOrden) => ({
          producto_id: d.producto_id,
          metros: d.detallesRollos
        }))

      if (rollosData.length > 0) {
        const metadata = {
          orden_id: ordenId,
          timestamps: new Date().toISOString(),
          rollos: rollosData
        }
        sessionStorage.setItem(`orden_${ordenId}_rollos`, JSON.stringify(metadata))
      }
    }

    success.value = true
    console.log("Orden creada:", payloadToSend);
    emit('created')

    // Generar PDF de la orden - no bloquea si falla
    try {
      await generateOrderPDF(payloadToSend, logo, inventarios.value, proveedores.value, proveedor_id.value ?? undefined)
    } catch (pdfError) {
      console.warn('Advertencia: No se pudo generar el PDF, pero la orden fue creada:', pdfError)
    }

    // Reset de formulario
    proveedor_id.value = null
    estado.value = 'pendiente'
    const resetDetalle: DetalleOrden = {
      producto_id: null,
      cantidad: 1,
      rollos: 0,
      precio_unitario: 0,
      busqueda: '',
      mostrarSugerencias: false,
      productoSeleccionado: null,
      tipoEntrada: 'estandar',
      cantidadRollosInput: 0,
      detallesRollos: [0]
    }
    detalles.value = [resetDetalle]
  } catch (e) {
    error.value = (e instanceof Error) ? e.message : 'Error al crear la orden'
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    proveedor_id.value = null
    estado.value = 'pendiente'
    const nuevoDetalle: DetalleOrden = {
      producto_id: null,
      cantidad: 1,
      rollos: 0,
      precio_unitario: 0,
      busqueda: '',
      mostrarSugerencias: false,
      productoSeleccionado: null,
      tipoEntrada: 'estandar',
      cantidadRollosInput: 0,
      detallesRollos: [0]
    }
    detalles.value = [nuevoDetalle]
    error.value = ''
    success.value = false
  }
})

function close() {
  emit('close')
  error.value = ''
  success.value = false
}

// Lógica de búsqueda individual por fila
const getProductosFiltrados = (index: number): Array<{ id: number; nombre: string; descripcion?: string; precio?: number }> => {
  const detalle: DetalleOrden | undefined = detalles.value[index]
  if (!detalle || !detalle.busqueda) return []
  const termino = detalle.busqueda.toLowerCase()
  if (termino.length < 2) return []

  return productos.value
    .filter((p): boolean => {
      const nombreMatch = p.nombre?.toLowerCase().includes(termino) ?? false
      const descripcionMatch = p.descripcion ? p.descripcion.toLowerCase().includes(termino) : false
      return nombreMatch || descripcionMatch
    })
    .slice(0, 10)
}

const onBusquedaInput = (index: number): void => {
  const detalle: DetalleOrden | undefined = detalles.value[index]
  if (!detalle) return
  if (detalle.busqueda.length >= 2) {
    detalle.mostrarSugerencias = true
    detalle.productoSeleccionado = null
    detalle.producto_id = null
  } else {
    detalle.mostrarSugerencias = false
  }
}

const seleccionarProducto = (index: number, producto: { id: number; nombre: string; descripcion?: string }): void => {
  const detalle: DetalleOrden | undefined = detalles.value[index]
  if (!detalle) return

  detalle.productoSeleccionado = producto
  detalle.producto_id = producto.id
  detalle.busqueda = producto.nombre
  detalle.mostrarSugerencias = false
}

const ocultarSugerencias = (index: number): void => {
  setTimeout(() => {
    const det = detalles.value[index]
    if (det) {
      det.mostrarSugerencias = false
    }
  }, 200)
}

const generarInputsRollos = (index: number): void => {
  const detalle: DetalleOrden | undefined = detalles.value[index]
  if (!detalle) return
  const n = parseInt(detalle.cantidadRollosInput as unknown as string) || 0
  if (n < 0) return

  if (n > detalle.detallesRollos.length) {
    const nuevos = new Array(n - detalle.detallesRollos.length).fill(0)
    detalle.detallesRollos = [...detalle.detallesRollos, ...nuevos]
  } else if (n < detalle.detallesRollos.length) {
    detalle.detallesRollos = detalle.detallesRollos.slice(0, n)
  }
}

const fetchProductos = async (): Promise<void> => {
  try {
    const response = await api.get('productos/all')

    // Mapear respuesta al formato esperado
    productos.value = response.data.map((item: { id: number; nombre: string; descripcion?: string; precio: string | number;[key: string]: unknown }) => ({
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      precio: typeof item.precio === 'string' ? parseFloat(item.precio) : item.precio
    }))
  } catch (err) {
    error.value = 'Error al cargar productos'
    console.error(err)
  }
}

const fetchInventarios = async (): Promise<void> => {
  try {
    const response = await api.get('inventarios')
    inventarios.value = Array.isArray(response.data) ? response.data : (response.data.items || [])
    console.log('✅ Inventarios cargados para PDF:', inventarios.value.length)
  } catch (err) {
    error.value = 'Error al cargar inventarios'
    console.error(err)
  }
}

const fetchProveedores = async (): Promise<void> => {
  try {
    const response = await api.get('proveedores')
    proveedores.value = response.data.items || response.data
  } catch (err) {
    error.value = 'Error al cargar proveedores'
    console.error(err)
  }
}

onMounted(async (): Promise<void> => {
  await fetchProductos()
  await fetchInventarios()
  await fetchProveedores()
})
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal">
      <h2>Crear Orden de Compra</h2>

      <div class="form-scroll">
        <form @submit.prevent="submitOrder">
          <div>
            <label>Nombre de proveedor:</label>
            <select v-model.number="proveedor_id" required>
              <option disabled value="">Seleccione un proveedor</option>
              <option v-for="p in proveedores" :key="p.id" :value="p.id">{{ p.nombre }}</option>
            </select>
          </div>

          <div>
            <h3>Detalles de la Orden</h3>
            <div v-for="(detalle, index) in detalles" :key="index" class="detalle-item">

              <!-- Buscador de productos por fila -->
              <div class="producto-search">
                <label>Producto:</label>
                <div class="search-container">
                  <input type="text" v-model="detalle.busqueda" @input="onBusquedaInput(index)"
                    @focus="onBusquedaInput(index)" @blur="ocultarSugerencias(index)"
                    placeholder="Escribe el nombre del producto..." autocomplete="off" required />

                  <!-- Sugerencias -->
                  <div v-if="detalle.mostrarSugerencias && getProductosFiltrados(index).length" class="sugerencias">
                    <div v-for="producto in getProductosFiltrados(index)" :key="producto.id"
                      @click="seleccionarProducto(index, producto)" class="sugerencia-item">
                      <div class="producto-nombre">{{ producto.nombre }}</div>
                      <div class="producto-descripcion">{{ producto.descripcion || 'Sin descripción' }}</div>
                    </div>
                  </div>

                  <!-- No resultados -->
                  <div
                    v-if="detalle.mostrarSugerencias && detalle.busqueda.length >= 2 && !getProductosFiltrados(index).length"
                    class="no-resultados">
                    No se encontraron productos
                  </div>
                </div>

                <!-- Producto seleccionado -->
                <div v-if="detalle.productoSeleccionado" class="producto-seleccionado">
                  <span class="check-icon">✓</span>
                  <strong>Seleccionado:</strong> {{ detalle.productoSeleccionado.nombre }}
                </div>
              </div>

              <div class="tipo-entrada-selector">
                <label>Tipo de Entrada:</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" v-model="detalle.tipoEntrada" value="estandar"> Por unidad
                  </label>
                  <label class="radio-label">
                    <input type="radio" v-model="detalle.tipoEntrada" value="rollos"> Por agrupación
                  </label>
                </div>
              </div>

              <div class="input-row" v-if="detalle.tipoEntrada === 'estandar'">
                <div class="input-half">
                  <label>Cantidad:</label>
                  <input type="number" v-model.number="detalle.cantidad" step="0.01" required />
                </div>

                <div class="remove-container">
                  <button type="button" class="remove-btn" @click="removeDetalle(index)"
                    title="Eliminar fila">✕</button>
                </div>
              </div>

              <!-- UI para Rollos de Tela -->
              <div v-else-if="detalle.tipoEntrada === 'rollos'">
                <div class="input-row">
                  <div class="input-half">
                    <label>Cantidad de Rollos:</label>
                    <input type="number" min="1" step="1" v-model.number="detalle.cantidadRollosInput"
                      @input="generarInputsRollos(index)" placeholder="Ej: 3" required />
                  </div>
                  <div class="remove-container">
                    <button type="button" class="remove-btn" @click="removeDetalle(index)"
                      title="Eliminar fila">✕</button>
                  </div>
                </div>

                <div class="rollos-inputs-grid" v-if="detalle.detallesRollos.length > 0">
                  <div v-for="(rollo, rIndex) in detalle.detallesRollos" :key="rIndex" class="rollo-input-item">
                    <label>Rollo {{ (rIndex as unknown as number) + 1 }} (m):</label>
                    <input type="number" step="0.01" min="0" v-model.number="detalle.detallesRollos[rIndex]"
                      placeholder="0.00" required />
                  </div>
                </div>
              </div>
            </div>
            <button type="button" class="add-btn" @click="addDetalle">+ Agregar Producto</button>
          </div>

          <div class="buttons">
            <button type="submit">Crear Orden</button>
            <button type="button" @click="close">Cancelar</button>
            <button type="button"
              @click="generateOrderPDF({ proveedor_id: proveedor_id, estado, detalles: getProcessedDetalles() }, logo, inventarios, proveedores, proveedor_id ?? undefined)">Generar
              PDF</button>
          </div>
        </form>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">¡Orden creada exitosamente!</p>
    </div>
  </div>
</template>

<style scoped>
h2,
h3 {
  color: #333;
  font-size: 1.5rem;
  margin: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(40, 48, 63, 0.35);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  padding: 2.5rem 2rem;
  border-radius: 18px;
  width: 500px;
  max-height: 90vh;
  max-width: 95vw;
  box-shadow: 0 8px 32px rgba(60, 60, 90, 0.18);
  display: flex;
  flex-direction: column;
  animation: modalIn 0.25s;
  overflow: hidden;
}

.form-scroll {
  overflow-y: auto;
  max-height: 60vh;
  padding-right: 0.5rem;
  /* Para dejar espacio al scrollbar */
}

.modal h2 {
  margin-bottom: 1rem;
  color: var(--color-brand-primary);
  font-weight: 600;
  text-align: center;
}

@keyframes modalIn {
  from {
    transform: translateY(40px) scale(0.97);
    opacity: 0;
  }

  to {
    transform: none;
    opacity: 1;
  }
}

form>div {
  margin-bottom: 1.2rem;
}

label {
  display: block;
  margin-bottom: 0.3rem;
  color: #444;
  font-size: 0.97rem;
  font-weight: 500;
}

input,
select {
  width: 90%;
  padding: 0.55rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 1rem;
  background: #f7fafc;
  transition: border 0.2s;
  margin-bottom: 0.5rem;
}

input:focus,
select:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #fff;
}

.detalle-item {
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.8rem;
  margin-bottom: 1rem;
}

button[type="submit"] {
  background: var(--gradient-brand-90);
  color: #fff;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  flex: 1;
}

button[type="submit"]:hover {
  background: var(--color-brand-secondary);
}

button[type="button"] {
  background: #FFF9E6;
  color: var(--color-brand-secondary);
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  flex: 1;
}

button[type="button"]:hover {
  background: #e5e7eb;
}

.buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: center;
  margin-top: 1.5rem;
}

/* Nuevos estilos integrados de CrearInventario */
.producto-search {
  margin-bottom: 1rem;
}

.search-container {
  position: relative;
}

.sugerencias {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #d1d5db;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 180px;
  overflow-y: auto;
  z-index: 1001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sugerencia-item {
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  text-align: left;
}

.sugerencia-item:hover {
  background: #f8fafc;
}

.producto-nombre {
  font-weight: 500;
  color: #1f2937;
  font-size: 0.95rem;
}

.producto-descripcion {
  font-size: 0.8rem;
  color: #6b7280;
}

.no-resultados {
  padding: 0.75rem;
  text-align: center;
  color: #6b7280;
  font-style: italic;
  background: #f9fafb;
}

.producto-seleccionado {
  margin-top: 0.4rem;
  padding: 0.4rem 0.6rem;
  background: #ecfdf5;
  border: 1px solid var(--color-brand-primary);
  border-radius: 6px;
  color: var(--color-brand-secondary);
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.check-icon {
  color: var(--color-brand-primary);
  font-weight: bold;
}

.input-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.input-half {
  flex: 1;
}

.remove-container {
  padding-bottom: 0.5rem;
}

.remove-btn {
  background: #fee2e2 !important;
  color: #dc2626 !important;
  padding: 0.5rem !important;
  min-width: 38px !important;
  border-radius: 50% !important;
  font-size: 0.9rem !important;
}

.add-btn {
  width: 100%;
  margin-top: 0.5rem;
  background: #FFF9E6 !important;
  color: var(--color-brand-primary) !important;
  border: 1px dashed var(--color-brand-primary) !important;
}

.detalle-item {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #edf2f7;
  margin-bottom: 1rem;
}

.error {
  margin-top: 1rem;
  text-align: center;
  font-weight: 500;
  color: red;
}

.success {
  margin-top: 1rem;
  text-align: center;
  font-weight: 500;
  color: green;
}

/* Estilos adicionales para Rollos */
.tipo-entrada-selector {
  margin-bottom: 1rem;
}

.radio-group {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.4rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
}

.radio-label input {
  width: auto;
  margin: 0;
}

.rollos-inputs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.rollo-input-item label {
  font-size: 0.8rem;
  color: #6b7280;
  margin-bottom: 0.2rem;
}
</style>
