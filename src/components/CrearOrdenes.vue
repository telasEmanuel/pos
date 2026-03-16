<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import api from '../api/axios'
import { jsPDF } from 'jspdf'
import logo from '../assets/logoT.png'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'created'])
const productos = ref<Array<{ id: number; nombre: string; precio: number; descripcion?: string }>>([])
const inventarios = ref<Array<{ id: number; producto_id: number; bodega_id: number;[key: string]: unknown }>>([])
const proveedores = ref<Array<{ id: number; nombre: string; contacto: string;[key: string]: unknown }>>([])
const proveedor_id = ref<number | null>(null)
const estado = ref<string>('pendiente')
const detalles = ref<Array<{ producto_id: number | null; cantidad: number; rollos: number; precio_unitario: number; busqueda: string; mostrarSugerencias: boolean; productoSeleccionado: { id: number; nombre: string } | null; tipoEntrada: string; cantidadRollosInput: number; detallesRollos: number[] }>>([
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
  detalles.value.push({
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
  })
}

function removeDetalle(index: number): void {
  detalles.value.splice(index, 1)
}

function getProcessedDetalles(): Array<{ producto_id: number | null; cantidad: number; rollos: number; precio_unitario: number; tipo: string; measurements: number[] }> {
  const map = new Map()

  detalles.value.forEach(d => {
    if (!d.producto_id) return

    const key = `${d.producto_id}_${d.tipoEntrada}`
    if (!map.has(key)) {
      map.set(key, {
        producto_id: d.producto_id,
        cantidad: 0,
        rollos: 0,
        precio_unitario: 0,
        tipo: d.tipoEntrada,
        measurements: []
      })
    }

    const item = map.get(key)
    if (d.tipoEntrada === 'rollos') {
      d.detallesRollos.forEach((m: number) => {
        const val = Number(m)
        item.cantidad += val
        item.rollos += 1
        if (val > 0) item.measurements.push(val)
      })
    } else {
      item.cantidad += Number(d.cantidad)
    }
  })

  return Array.from(map.values())
}

async function submitOrder(): Promise<void> {
  error.value = ''
  success.value = false

  const processedDetalles = getProcessedDetalles()

  const hasSelectedProducts = detalles.value.some(d => d.producto_id !== null)

  if (!proveedor_id.value) {
    error.value = 'El proveedor es requerido'
    return
  }

  if (!hasSelectedProducts) {
    error.value = 'Debe seleccionar al menos un producto'
    return
  }

  if (processedDetalles.length === 0) {
    error.value = 'Debe agregar al menos un producto con la información completa'
    return
  }

  try {
    const payloadToSend = {
      proveedor_id: proveedor_id.value,
      estado: estado.value,
      detalles: processedDetalles.filter((d) => d.producto_id !== null)
    } as const

    await api.post('ordenes', payloadToSend)
    success.value = true
    console.log("Orden creada:", payloadToSend);
    emit('created')

    // Generar PDF de la orden
    generatePDF(payloadToSend)

    // Reset de formulario
    proveedor_id.value = null
    estado.value = 'pendiente'
    detalles.value = [{
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
    }]
  } catch (e) {
    error.value = (e instanceof Error) ? e.message : 'Error al crear la orden'
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    proveedor_id.value = null
    estado.value = 'pendiente'
    detalles.value = [{
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
    }]
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
  const detalle = detalles.value[index]
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
  const detalle = detalles.value[index]
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
  const detalle = detalles.value[index]
  if (!detalle) return
  detalle.productoSeleccionado = producto
  detalle.producto_id = producto.id
  detalle.busqueda = producto.nombre
  detalle.mostrarSugerencias = false
}

const ocultarSugerencias = (index: number): void => {
  setTimeout(() => {
    if (detalles.value[index]) {
      detalles.value[index].mostrarSugerencias = false
    }
  }, 200)
}

const generarInputsRollos = (index: number): void => {
  const detalle = detalles.value[index]
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
    const response = await api.get('inventarios')
    inventarios.value = response.data

    // Extraer productos únicos para el select
    const uniqueProds: Array<{ id: number; nombre: string; descripcion?: string; precio: number }> = []
    const seenIds = new Set<number>()
    response.data.forEach((item: { producto?: { id: number; nombre: string; descripcion?: string; precio?: number } }): void => {
      if (item.producto && !seenIds.has(item.producto.id)) {
        const prod: { id: number; nombre: string; descripcion?: string; precio: number } = {
          id: item.producto.id,
          nombre: item.producto.nombre,
          precio: item.producto.precio ?? 0
        }
        if (item.producto.descripcion !== undefined) {
          prod.descripcion = item.producto.descripcion
        }
        uniqueProds.push(prod)
        seenIds.add(item.producto.id)
      }
    })
    productos.value = uniqueProds
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
  await fetchProveedores()
})

type DetalleOrden = { producto_id: number | null; cantidad: number; precio_unitario: number; tipo?: string; measurements?: number[]; rollos?: number }

function generatePDF(payload: { proveedor_id?: number; detalles?: DetalleOrden[] }): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new (jsPDF as any)()

  // Colores basados en tu logo (naranja/dorado y gris)
  const primaryColor: number[] = [242, 169, 59] // Naranja/dorado del logo
  const secondaryColor: number[] = [80, 80, 80] // Gris oscuro

  // ============ ENCABEZADO ============
  // Logo más grande ocupando más espacio a la izquierda
  doc.addImage(logo, 'PNG', 15, 10, 50, 25) // Aumentado de 30x30 a 50x35

  // Nombre de la empresa - CENTRADO
  doc.setFontSize(24)
  doc.setTextColor(primaryColor[0] as number, primaryColor[1] as number, primaryColor[2] as number)
  doc.setFont('helvetica', 'bold')
  doc.text('Telas Emanuel', 105, 25, { align: 'center' })

  // Título del documento - CENTRADO
  doc.setFontSize(16)
  doc.setTextColor(secondaryColor[0] as number, secondaryColor[1] as number, secondaryColor[2] as number)
  doc.text('ORDEN DE COMPRA', 105, 35, { align: 'center' })

  // ============ INFORMACIÓN DE CONTACTO (Derecha) ============
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  const rightMargin = 195
  doc.text('Dirección de la Empresa', rightMargin, 15, { align: 'right' })
  doc.text('Supermanzana 94, 77517', rightMargin, 20, { align: 'right' })
  doc.text('Cancún, Quintana Roo', rightMargin, 25, { align: 'right' })
  doc.text('telasemanuel23@hotmail.com', rightMargin, 30, { align: 'right' })
  doc.text('(998) 260 3290', rightMargin, 35, { align: 'right' })

  // Línea separadora
  doc.setDrawColor(primaryColor[0] as number, primaryColor[1] as number, primaryColor[2] as number)
  doc.setLineWidth(0.5)
  doc.line(15, 45, 195, 45)

  // ============ INFORMACIÓN DEL PROVEEDOR ============
  const proveedor = proveedores.value.find(p => p.id === proveedor_id.value)
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('Proveedor:', 15, 55)

  doc.setFont('helvetica', 'normal')
  doc.text(proveedor ? proveedor.nombre : 'No encontrado', 40, 55)

  /*doc.setFont('helvetica', 'bold')
  doc.text('Enviar a:', 15, 62)

  doc.setFont('helvetica', 'normal')
  doc.text('846 Av. Puerto Juárez, 77517, Cancún, Q.R.', 40, 62)*/

  // ============ TABLA DE PRODUCTOS ============
  let yPosition = 75

  // Encabezado de la tabla con color naranja
  doc.setFillColor(primaryColor[0] as number, primaryColor[1] as number, primaryColor[2] as number)
  doc.rect(15, yPosition, 180, 8, 'F')

  // Verificar visibilidad de columnas
  const mostrarCantidad = (payload.detalles ?? []).some((d: DetalleOrden): boolean => Number(d.cantidad) > 0)
  const mostrarRollos = (payload.detalles ?? []).some((d: DetalleOrden): boolean => d.tipo === 'rollos')

  // Posiciones dinámicas (Descripción siempre en 17)
  const posCantidad = 110
  let posRollos = 110 // Valor inicial

  if (mostrarCantidad && mostrarRollos) {
    posRollos = 135 // Si ambos, rollos va a la derecha
  }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('DESCRIPCIÓN DEL ARTÍCULO', 17, yPosition + 5.5)

  if (mostrarCantidad) {
    doc.text('CANTIDAD', posCantidad, yPosition + 5.5)
  }

  if (mostrarRollos) {
    doc.text('ROLLOS', posRollos, yPosition + 5.5)
  }

  yPosition += 8

  // Productos
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

    (payload.detalles ?? []).forEach((detalle: DetalleOrden, index: number): void => {
      const invItem = inventarios.value.find(inv => inv.producto_id === detalle.producto_id) as { producto: { nombre: string }; medida_ind?: string; medida_gru?: string } | undefined
      if (invItem) {
        const productoNombre = invItem.producto.nombre
        const cantidadItem = detalle.cantidad
        const rollosItem = detalle.rollos
        const medidaInd = String(invItem.medida_ind || '')
        const medidaGru = String(invItem.medida_gru || '')

        // Preparar el nombre con medidas si es tipo rollos
        let displayNombre = productoNombre.toUpperCase()
        if (detalle.tipo === 'rollos' && detalle.measurements && detalle.measurements.length > 0) {
          displayNombre += ` (${detalle.measurements.join(', ')} ${medidaInd})`
        }

        // Calcular líneas y altura de fila
        const maxWidth = (mostrarCantidad ? posCantidad : posRollos) - 20
        const lines = doc.splitTextToSize(displayNombre, maxWidth)
        const rowHeight = Math.max(10, lines.length * 5 + 2)

        // Fondo alternado para filas
        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 245)
          doc.rect(15, yPosition, 180, rowHeight, 'F')
        }

        // Información de las columnas
        doc.setFont('helvetica', 'bold')
        lines.forEach((line: string, i: number): void => {
          doc.text(line, 17, yPosition + 6 + (i * 5))
        })

        doc.setFont('helvetica', 'normal')
        if (mostrarCantidad) {
          if (cantidadItem > 0) {
            doc.text(`${cantidadItem} ${medidaInd}`, posCantidad + 7, yPosition + 6, { align: 'center' })
          }
        }

        if (mostrarRollos && detalle.tipo === 'rollos') {
          doc.text(`${rollosItem} ${medidaGru}`, posRollos + 7, yPosition + 6, { align: 'center' })
        }

        yPosition += rowHeight
      }
    })

  // Línea separadora
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(15, yPosition + 2, 195, yPosition + 2)

  // ============ PIE DE PÁGINA ============
  const footerY = 265

  // Nota de factura - ROJO Y NEGRILLA
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 0, 0)
  doc.text('Nota: enviar factura al correo telasemanuel23@hotmail.com', 105, footerY + 2, { align: 'center' })

  // ============ GUARDAR PDF ============
  doc.save(`orden_compra_${proveedor ? proveedor.nombre : 'no_proveedor'}.pdf`)
}
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
                    <input type="radio" v-model="detalle.tipoEntrada" value="estandar"> Estándar
                  </label>
                  <label class="radio-label">
                    <input type="radio" v-model="detalle.tipoEntrada" value="rollos"> Rollos de Tela
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
              @click="generatePDF({ proveedor_id: proveedor_id as any, estado, detalles: getProcessedDetalles() } as any)">Generar
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
  color: #2563eb;
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
  border-color: #4f8cff;
  outline: none;
  background: #fff;
}

.detalle-item {
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.8rem;
  margin-bottom: 1rem;
}

button[type="submit"] {
  background: #4f8cff;
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
  background: #2563eb;
}

button[type="button"] {
  background: #f3f4f6;
  color: #333;
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
  border: 1px solid #10b981;
  border-radius: 6px;
  color: #065f46;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.check-icon {
  color: #10b981;
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
  background: #f0f7ff !important;
  color: #2563eb !important;
  border: 1px dashed #2563eb !important;
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
