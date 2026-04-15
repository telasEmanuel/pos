<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import api from 'src/api/axios'
import { useQuasar, date } from 'quasar'
import ReceiptPrinter from 'src/components/ReceiptPrinter.vue'
import RefundModal from 'src/components/RefundModal.vue'
import type { ReceiptData } from 'src/components/types'
import { useAuthStore } from 'src/stores/auth'

interface Usuario {
  id: number
  username: string
  email: string
  nombre?: string
}

interface DetalleVenta {
  id: number
  producto_id: number
  cantidad: number
  precio_unitario: number
  medida?: string
  producto?: {
    nombre: string
  }
}

interface Venta {
  id: number
  fecha_venta: string
  cliente: string | null
  total: number
  comentarios: string | null
  metodo_pago: string
  usuario_id?: number | null
  usuario_username?: string | null
  usuario?: Usuario
  requiere_factura?: boolean
  detallesVenta: DetalleVenta[]
}

const $q = useQuasar()
const authStore = useAuthStore()
const ventas = ref<Venta[]>([])
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref<number | null>(null)
const loading = ref(true)
const productosMap = ref<Map<number, string>>(new Map())
const medidasMap = ref<Map<number, string>>(new Map())
const receiptPrinter = ref<InstanceType<typeof ReceiptPrinter> | null>(null)
const lastReceipt = ref<ReceiptData | null>(null)
/*const refundModal = ref<InstanceType<typeof RefundModal> | null>(null)
const ventaSeleccionadaParaReembolso = ref<Venta | null>(null)*/
const ventaExpandida = ref<Venta | null>(null)

const ventaExpandidaOpen = computed({
  get: () => ventaExpandida.value !== null,
  set: (valor) => {
    if (!valor) {
      ventaExpandida.value = null
    }
  }
})

// Date selection
const todayFormatted = date.formatDate(Date.now(), 'DD/MM/YYYY')
const dateRange = ref<string>(todayFormatted)

const displayDate = computed(() => {
  return dateRange.value
})

const formatCurrency = (amount: number | string | undefined | null) => {
  if (amount === undefined || amount === null) return '$0.00'
  return Number(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  })
}

const formatTime = (dateString: string | undefined | null) => {
  if (!dateString) return ''
  return date.formatDate(dateString, 'HH:mm A')
}

const formatDateLong = (dateString: string | undefined | null) => {
  if (!dateString) return ''
  return date.formatDate(dateString, 'DD/MM/YYYY')
}

const parseDetailedPaymentComment = (rawComment: string | null): {
  comments: string
  pagoDetalle?: ReceiptData['pagoDetalle']
} => {
  const comment = rawComment ?? ''
  const detailMatch = comment.match(/\[Detalle Pago:([^\]]+)\]/i)

  if (!detailMatch || !detailMatch[1]) {
    return { comments: comment.trim() }
  }

  const detailText = detailMatch[1]

  const parseAmount = (regex: RegExp): number => {
    const match = detailText.match(regex)
    if (!match || !match[1]) return 0
    const value = parseFloat(match[1])
    return Number.isFinite(value) ? value : 0
  }

  const efectivo = parseAmount(/Pesos:\s*\$([\d.]+)/i)
  const dolares = parseAmount(/USD:\s*([\d.]+)/i)
  const tasaCambio = parseAmount(/\(Tasa:\s*([\d.]+)\)/i)
  const tarjeta = parseAmount(/Tarjeta:\s*\$([\d.]+)/i)
  const transferencia = parseAmount(/Transf:\s*\$([\d.]+)/i)
  const totalPagado = efectivo + tarjeta + transferencia + dolares * tasaCambio

  const cleanedComment = comment.replace(detailMatch[0], '').trim()

  return {
    comments: cleanedComment,
    pagoDetalle: {
      efectivo,
      tarjeta,
      transferencia,
      dolares,
      tasaCambio,
      totalPagado: Number(totalPagado.toFixed(2))
    }
  }
}

const buildReceiptFromVenta = (venta: Venta): ReceiptData => {
  const parsed = parseDetailedPaymentComment(venta.comentarios)

  let atendidoPor = 'MOSTRADOR'

  try {
    if (venta.usuario_username) {
      atendidoPor = venta.usuario_username
    } else if (venta.usuario?.username) {
      atendidoPor = venta.usuario.username
    } else if (authStore.user?.username) {
      atendidoPor = authStore.user.username
    } else {
      const authUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
      if (authUser?.username) {
        atendidoPor = authUser.username
      }
    }
  } catch {
    // Si hay error, seguir con fallback
  }

  return {
    cliente: (venta.cliente || 'Cliente General').trim(),
    productos: (venta.detallesVenta || []).map((detalle) => ({
      cantidad: Number(detalle.cantidad || 0),
      medida: (detalle.medida || getProductoMedida(detalle.producto_id)).trim(),
      nombre: getProductoNombre(detalle.producto_id),
      precio_unitario: Number(detalle.precio_unitario || 0)
    })),
    total: Number(venta.total || 0),
    metodoPago: String(venta.metodo_pago || 'EFECTIVO').toUpperCase(),
    fecha: venta.fecha_venta,
    ticketId: venta.id,
    atendidoPor,
    ...(parsed.comments ? { comentarios: parsed.comments } : {}),
    ...(parsed.pagoDetalle ? { pagoDetalle: parsed.pagoDetalle } : {})
  }
}

const loadVentas = async () => {
  loading.value = true
  try {
    const [day, month, year] = (dateRange.value || todayFormatted).split('/')
    const inicio = `${year}-${month}-${day}`
    const fin = inicio

    const params: { inicio: string; fin: string; usuario_id?: number; _t?: number } = {
      inicio,
      fin,
      _t: Date.now()
    }
    if (usuarioSeleccionado.value !== null) {
      params.usuario_id = usuarioSeleccionado.value
    }

    const { data } = await api.get<{ ventas: Venta[] }>('ventas/rango', { params })

    const ventasFiltradas = data.ventas.filter(venta => {
      const fechaVenta = venta.fecha_venta?.split('T')[0] ?? ''
      return fechaVenta === inicio
    })

    ventas.value = ventasFiltradas.sort((a, b) => {
      return new Date(b.fecha_venta).getTime() - new Date(a.fecha_venta).getTime()
    })
  } catch (error) {
    console.error(error)
    $q.notify({
      message: 'Error al cargar el historial de ventas',
      color: 'negative',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

const loadProductos = async () => {
  try {
    const res = await api.get('inventarios')
    const items = Array.isArray(res.data) ? res.data : res.data.items ?? []

    items.forEach((item: {
      producto_id?: number
      producto?: { id?: number; nombre?: string; medida?: string; medida_ind?: string }
      medida?: string
      medida_ind?: string
    }) => {
      const productoId = item.producto_id ?? item.producto?.id
      const nombre = item.producto?.nombre
      const medida =
        item.medida || item.medida_ind || item.producto?.medida || item.producto?.medida_ind || 'pieza'
      if (productoId && nombre) {
        productosMap.value.set(productoId, nombre)
        medidasMap.value.set(productoId, medida.trim())
      }
    })
  } catch (error) {
    console.error('Error al cargar productos:', error)
  }
}

const loadUsuarios = async () => {
  try {
    const res = await api.get('usuarios')
    const data = Array.isArray(res.data) ? res.data : res.data.usuarios ?? []
    usuarios.value = data.map((u: Record<string, unknown>) => ({
      id: (u.id ?? u.Id) as number,
      username: (u.username ?? u.Username) as string,
      email: (u.email ?? u.Email) as string,
      nombre: (u.nombre ?? u.Nombre) as string
    }))
  } catch (error) {
    console.error('Error al cargar usuarios:', error)
  }
}

const getProductoNombre = (productoId: number): string => {
  return productosMap.value.get(productoId) || `Producto #${productoId}`
}

const getProductoMedida = (productoId: number): string => {
  return medidasMap.value.get(productoId) || 'pieza'
}

const printVenta = async (venta: Venta) => {
  lastReceipt.value = buildReceiptFromVenta(venta)
  await nextTick()
  receiptPrinter.value?.print()
}

/*const abrirModalReembolso = (venta: Venta) => {
  ventaSeleccionadaParaReembolso.value = venta
  refundModal.value?.abrirModal(venta)
}*/

const manejarReembolsoCompletado = () => {
  void loadVentas()
}

const seleccionarTicket = (venta: Venta) => {
  ventaExpandida.value = venta
}

const generarTicketHTML = (receipt: ReceiptData): string => {
  const productsHTML = receipt.productos
    .map(
      p =>
        `<div style="display: flex; justify-content: space-between; word-break: break-word;">
      <div style="flex: 1;"><strong>${p.nombre}</strong></div>
      <div style="text-align: right; white-space: nowrap; margin-left: 8px;">${formatCurrency(p.cantidad * p.precio_unitario)}</div>
    </div>
    <div style="font-size: 0.85em; color: #666;">${p.cantidad} ${p.medida} x ${formatCurrency(p.precio_unitario)}</div>`
    )
    .join('')

  return `
    <div style="font-family: 'Courier New', monospace; line-height: 1.4; padding: 8px; font-size: 11px;">
      <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
        <strong>TELAS EMANUEL</strong><br/>
        <div style="font-size: 0.9em;">Ticket #${receipt.ticketId}</div>
        <div style="font-size: 0.9em;">${formatDateLong(receipt.fecha)} ${formatTime(receipt.fecha)}</div>
      </div>

      <div style="margin-bottom: 8px;">
        <div><strong>Cliente:</strong> ${receipt.cliente}</div>
        <div><strong>Forma Pago:</strong> ${receipt.metodoPago}</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 4px 0;">
        ${productsHTML}
      </div>

      <div style="text-align: right; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
        <strong>TOTAL: ${formatCurrency(receipt.total)}</strong>
      </div>

      ${receipt.comentarios ? `<div style="font-size: 0.9em; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000;">Notas: ${receipt.comentarios.substring(0, 50)}</div>` : ''}
    </div>
  `
}

watch(dateRange, () => {
  void loadVentas()
})

watch(usuarioSeleccionado, () => {
  void loadVentas()
})

onMounted(async () => {
  await loadUsuarios()
  void loadVentas()
  void loadProductos()
})
</script>

<template>
  <q-page class="impresiones-page q-pa-md">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h1 class="text-h4 text-weight-bolder text-grey-9 q-my-none">Tickets</h1>
        <div class="row items-center q-mt-sm">
          <div class="text-subtitle1 text-grey-7 q-mr-md">
            Fecha: <span class="text-weight-bold text-primary">{{ displayDate }}</span>
          </div>
          <q-btn icon="event" round flat color="primary" dense>
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-date v-model="dateRange" mask="DD/MM/YYYY">
                <div class="row items-center justify-end q-gutter-sm">
                  <q-btn label="Cerrar" color="primary" flat v-close-popup />
                </div>
              </q-date>
            </q-popup-proxy>
          </q-btn>
        </div>
      </div>
      <div class="row q-gutter-sm">
        <!--<q-select
          v-model="usuarioSeleccionado"
          :options="[{ label: 'Todos los usuarios', value: null }, ...usuarios.map(u => ({ label: u.username || u.email, value: u.id }))]"
          outlined
          dense
          emit-value
          map-options
          style="min-width: 200px"
        >
          <template v-slot:prepend>
            <q-icon name="person" />
          </template>
        </q-select>-->
        <q-btn icon="refresh" flat round color="primary" @click="loadVentas" :loading="loading">
          <q-tooltip>Actualizar Datos</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Tickets Gallery -->
    <div v-if="loading" class="row justify-center q-py-lg">
      <q-spinner-dots size="3rem" color="primary" />
    </div>

    <div v-else-if="ventas.length === 0" class="empty-state text-center q-py-xl">
      <q-icon name="receipt_long" size="4rem" color="grey-4" />
      <p class="text-grey-5 q-mt-md text-h6">No hay ventas registradas para esta fecha</p>
    </div>

    <div v-else>
      <!-- Tickets Gallery -->
      <div class="row q-col-gutter-md">
        <!-- Each ticket as a card -->
        <div
          v-for="venta in ventas"
          :key="venta.id"
          class="col-12 col-sm-6 col-md-4 col-lg-3"
        >
          <q-card class="ticket-card shadow-1 cursor-pointer" @click="seleccionarTicket(venta)">
            <!-- Card Header -->
            <q-card-section class="ticket-header q-pa-sm">
              <div class="row items-center justify-between">
                <div class="text-subtitle2 text-weight-bold">
                  Ticket #{{ venta.id }}
                </div>
                <q-badge color="primary" text-color="white" rounded>
                  {{ formatTime(venta.fecha_venta) }}
                </q-badge>
              </div>
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ formatDateLong(venta.fecha_venta) }}
              </div>
            </q-card-section>

            <!-- Card Body - Receipt Preview (Miniatura) -->
            <q-card-section class="ticket-body q-pa-sm">
              <div
                class="receipt-ticket-display bg-white rounded-borders"
                style="border: 1px solid #e0e0e0; padding: 8px; overflow: hidden; max-height: 320px; overflow-y: auto;"
                v-html="generarTicketHTML(buildReceiptFromVenta(venta))"
              />
            </q-card-section>

            <!-- Card Footer -->
            <q-card-section class="ticket-footer q-pa-sm">
              <div class="row items-center justify-between full-width">
                <div>
                  <div class="text-subtitle2 text-weight-bold text-primary">
                    {{ formatCurrency(venta.total) }}
                  </div>
                  <div class="text-caption text-grey-6">
                    {{ venta.metodo_pago }}
                  </div>
                </div>
                <div class="row q-gutter-xs">
                  <q-btn icon="print" flat round dense color="primary" @click.stop="printVenta(venta)" size="sm">
                    <q-tooltip>Imprimir</q-tooltip>
                  </q-btn>
                  <!--<q-btn icon="assignment_return" flat round dense color="orange-8" @click.stop="abrirModalReembolso(venta)" size="sm">
                    <q-tooltip>Reembolso</q-tooltip>
                  </q-btn>-->
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Modal Expandido para Ver Ticket Completo -->
      <q-dialog v-model="ventaExpandidaOpen" maximized>
        <q-card class="expanded-ticket-modal">
          <!-- Header del Modal -->
          <q-card-section class="bg-primary text-white row items-center justify-between q-pa-md">
            <div>
              <h3 class="text-h5 text-weight-bold q-my-none">Ticket #{{ ventaExpandida?.id }}</h3>
              <div class="text-subtitle2 q-mt-xs">{{ formatDateLong(ventaExpandida?.fecha_venta) }} - {{ formatTime(ventaExpandida?.fecha_venta) }}</div>
            </div>
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <!-- Contenido del Modal -->
          <q-card-section class="scroll expanded-content q-pa-lg">
            <div class="row justify-center">
              <div style="max-width: 500px; width: 100%; background: white; padding: 16px; border: 1px solid #ddd; border-radius: 8px;">
                <div
                  v-if="ventaExpandida"
                  v-html="generarTicketHTML(buildReceiptFromVenta(ventaExpandida))"
                  style="font-size: 12px;"
                />
              </div>
            </div>
          </q-card-section>

          <!-- Action Buttons -->
          <q-card-actions align="right" class="q-pa-md bg-grey-1">
            <q-btn
              color="primary"
              icon="print"
              label="Imprimir Ticket"
              @click="printVenta(ventaExpandida!)"
              unelevated
            />
            <!--<q-btn
              color="orange-8"
              icon="assignment_return"
              label="Procesar Reembolso"
              @click="abrirModalReembolso(ventaExpandida!); ventaExpandidaOpen = false"
              unelevated
            />-->
            <q-btn label="Cerrar" color="grey-7" flat v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>

    <!-- Hidden Components -->
    <ReceiptPrinter ref="receiptPrinter" :data="lastReceipt" />
    <RefundModal ref="refundModal" @reembolso-completado="manejarReembolsoCompletado" />
  </q-page>
</template>

<style scoped>
.impresiones-page {
  background-color: #f5f5f5;
}

/* Ticket Cards */
.ticket-card {
  transition: all 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 2px solid transparent;
}

.ticket-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12) !important;
  border-color: #e0e0e0;
}

.ticket-card.active-ticket {
  border-color: #1976d2;
  background-color: #f3f8ff;
  box-shadow: 0 4px 20px rgba(25, 118, 210, 0.2) !important;
}

.ticket-header {
  background: linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%);
  border-bottom: 1px solid #e0e0e0;
}

.ticket-body {
  flex: 1;
  overflow: hidden;
  min-height: 350px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
}

.receipt-mini-preview {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.receipt-mini-preview :deep(*) {
  font-size: 10px !important;
  transform: scale(0.65);
  transform-origin: top center;
}

.ticket-footer {
  background: #f9f9f9;
  border-top: 1px solid #e0e0e0;
}

/* Modal Expandido */
.expanded-ticket-modal {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.expanded-content {
  flex: 1;
  overflow-y: auto;
  background: #f5f5f5;
}

/* Tickets List */
.tickets-list {
  max-height: 800px;
  overflow-y: auto;
}

.ticket-item {
  transition: all 0.2s ease;
}

.ticket-item:hover {
  background-color: #f9f9f9;
}

.ticket-item.bg-blue-1 {
  background-color: rgba(63, 81, 181, 0.1);
}

/* Empty state */
.empty-preview {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.receipt-preview-container {
  max-height: 800px;
  overflow-y: auto;
  border: 2px solid #e0e0e0;
}
</style>
