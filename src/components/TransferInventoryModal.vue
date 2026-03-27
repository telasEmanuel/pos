<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import api from 'src/api/axios';

interface ProductoTransferencia {
  id: number;
  producto_id: number;
  bodega_id: number;
  nombre: string;
  cantidadActual: number;
  cantidadTransferencia: number;
  medida_ind: string;
  precio_comp?: number;
  tieneRollos?: boolean;
  rolesTransferencia?: Array<{
    indice: number;
    cantidad: number;
    estado: string;
    id?: number;
  }>;
}

interface TransferenciaData {
  inventario_id: number;
  cantidad: number;
  desde_bodega: number;
  hacia_bodega: number;
  detalles_ids?: number[];
}

interface Props {
  show: boolean;
  productos: ProductoTransferencia[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const $q = useQuasar();
const isLoading = ref(false);

// Computar total de items a transferir y valor
const totalItems = computed(() => {
  return props.productos.reduce((total, p) => total + p.cantidadTransferencia, 0);
});

const totalValue = computed(() => {
  return props.productos.reduce((total, p) => {
    return total + (p.cantidadTransferencia * (p.precio_comp || 0));
  }, 0);
});

const formatNumber = (val: number | undefined) => {
  if (!val) return '0';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

const formatCurrency = (val: number) => {
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const processTransfer = async () => {
  // Validar que hay productos para transferir
  const productosConCantidad = props.productos.filter(p => p.cantidadTransferencia > 0);

  if (productosConCantidad.length === 0) {
    $q.notify({
      message: 'Selecciona al menos un producto para transferir',
      color: 'warning',
      icon: 'info'
    });
    return;
  }

  isLoading.value = true;

  try {
    // Preparar datos para la transferencia
    const transferData = productosConCantidad.map(p => {
      const transferencia: TransferenciaData = {
        inventario_id: p.id,
        cantidad: p.cantidadTransferencia,
        desde_bodega: p.bodega_id,
        hacia_bodega: 1 // Tienda
      };

      // Si hay rollos/detalles seleccionados, enviar sus IDs
      if (Array.isArray(p.rolesTransferencia) && p.rolesTransferencia.length > 0) {
        // Mapear los IDs de los detalles seleccionados
        transferencia.detalles_ids = p.rolesTransferencia
          .map(r => r.id)
          .filter(id => id !== undefined); // Filtrar solo los que tienen ID
      }

      return transferencia;
    });

    // Hacer la llamada API
    await api.post('transferencias', {
      transferencias: transferData
    });

    $q.notify({
      message: `✅ Transferencia completada: ${productosConCantidad.length} producto(s) movido(s)`,
      color: 'positive',
      icon: 'done_all',
      position: 'top'
    });

    emit('success');
    emit('close');

  } catch (error) {
    console.error('Error en la transferencia:', error);
    $q.notify({
      message: 'Error al procesar la transferencia. Intenta nuevamente.',
      color: 'negative',
      icon: 'error',
      position: 'top'
    });
  } finally {
    isLoading.value = false;
  }
};

const closeModal = () => {
  emit('close');
};
</script>

<template>
  <q-dialog :model-value="show" @update:model-value="closeModal" position="bottom" full-width>
    <q-card style="min-height: 60vh; max-height: 90vh; display: flex; flex-direction: column;">
      <!-- Header -->
      <q-card-section class="bg-gradient text-white q-pa-md" style="background: var(--gradient-brand-135);">
        <div class="row items-center justify-between">
          <div>
            <h2 class="q-ma-none text-h5" style="font-weight: 800;">🚚 Transferencia de Inventario</h2>
            <p class="q-ma-none q-mt-xs text-subtitle2 text-white-50">De Bodega a Tienda</p>
          </div>
          <q-btn icon="close" flat round dense color="white" @click="closeModal" size="lg" />
        </div>
      </q-card-section>

      <!-- Content - Scrollable -->
      <q-scroll-area style="flex: 1;">
        <q-card-section class="q-pa-lg">
          <!-- Productos a transferir -->
          <div v-if="productos.length" class="space-y-4">
            <div v-for="prod in productos" :key="prod.id" class="product-item"
              style="background: #f8f9fa; border-left: 4px solid var(--color-brand-primary); padding: 1rem; border-radius: 8px;">
              <div class="row justify-between items-center q-mb-md">
                <div>
                  <h4 class="q-ma-none text-weight-bold text-grey-9">{{ prod.nombre }}</h4>
                  <p class="q-ma-none q-mt-xs text-caption text-grey-6">Stock disponible: {{
                    formatNumber(prod.cantidadActual) }} {{ prod.medida_ind }}</p>
                </div>
              </div>

              <!-- Input de cantidad -->
              <div class="row items-center gap-2">
                <label class="text-weight-600 text-grey-8" style="min-width: 100px;">A transferir:</label>
                <q-input v-model.number="prod.cantidadTransferencia" type="number" min="0" :max="prod.cantidadActual"
                  outlined dense class="col-grow" style="max-width: 150px;" @update:model-value="(val: string | number | null) => {
                    const numVal = typeof val === 'string' ? parseInt(val, 10) || 0 : (val || 0);
                    if (numVal > prod.cantidadActual) prod.cantidadTransferencia = prod.cantidadActual;
                    else prod.cantidadTransferencia = Math.max(0, numVal);
                  }" />
                <span class="text-weight-600 text-grey-7">{{ prod.medida_ind }}</span>
              </div>

              <!-- Subtotal -->
              <div v-if="prod.precio_comp && prod.cantidadTransferencia > 0" class="q-mt-md">
                <p class="q-ma-none text-sm text-grey-7">
                  Subtotal: <span class="text-weight-bold text-primary">{{ formatCurrency(prod.cantidadTransferencia *
                    prod.precio_comp) }}</span>
                </p>
              </div>

              <!-- Detalle de Rollos (si los hay) -->
              <div v-if="prod.tieneRollos && prod.rolesTransferencia && prod.rolesTransferencia.length > 0"
                class="q-mt-md">
                <p class="q-ma-none text-sm text-weight-bold text-grey-8 q-mb-sm">
                  📦 Rollos a transferir:
                </p>
                <div class="rollo-detail" v-for="rollo in prod.rolesTransferencia" :key="rollo.indice">
                  <span class="rollo-detail-text">Rollo #{{ rollo.indice + 1 }}: <strong>{{ formatNumber(rollo.cantidad)
                      }} {{ prod.medida_ind }}</strong></span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-grey-5">
            <p>No hay productos seleccionados</p>
          </div>
        </q-card-section>
      </q-scroll-area>

      <!-- Summary Bar -->
      <q-separator />
      <q-card-section class="bg-grey-1 q-pa-md">
        <div class="row justify-between items-center">
          <div>
            <p class="q-ma-none text-caption text-grey-6">Total de productos</p>
            <p class="q-ma-none text-h6 text-weight-bold">{{ totalItems }} unidades</p>
          </div>
          <div class="text-right">
            <p class="q-ma-none text-caption text-grey-6">Valor total</p>
            <p class="q-ma-none text-h6 text-weight-bold text-positive">{{ formatCurrency(totalValue) }}</p>
          </div>
        </div>
      </q-card-section>

      <!-- Actions -->
      <q-card-section class="q-pa-md">
        <div class="row gap-2">
          <q-btn label="Cancelar" outline color="grey-7" class="col" @click="closeModal" :disable="isLoading" />
          <q-btn label="Transferir Ahora" unelevated color="positive" text-color="white" class="col"
            @click="processTransfer" :loading="isLoading" :disable="totalItems === 0" icon-right="send" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.bg-gradient {
  background: var(--gradient-brand-135);
}

:deep(.space-y-4)>*+* {
  margin-top: 1rem;
}

.rollo-detail {
  padding: 0.5rem 0.75rem;
  background: #fff8e6;
  border-left: 3px solid var(--color-brand-primary);
  border-radius: 4px;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.rollo-detail-text {
  color: var(--color-brand-secondary);
}
</style>
