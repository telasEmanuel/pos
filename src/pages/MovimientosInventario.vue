<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from 'src/api/axios';
import { useQuasar } from 'quasar';

interface Movimiento {
  id: number;
  productoNombre: string;
  cantidad: number;
  tipo: string;
  fecha: Date;
}

interface Transferencia {
  id: number;
  cantidad: number | string;
  fecha_transferencia: string | Date;
  producto?: {
    nombre: string;
  };
}

interface ApiResponse {
  items?: Transferencia[];
}

const $q = useQuasar();
const loading = ref(true);
const filter = ref('');
const error = ref<string | null>(null);
const movimientos = ref<Movimiento[]>([]);

const columns: { 
  name: string; 
  align: 'left' | 'center' | 'right'; 
  label: string; 
  field: string | ((row: Movimiento) => string | number | Date); 
  format?: (val: string | number | Date | null | undefined) => string;
  sortable?: boolean 
}[] = [
  { name: 'id', align: 'left', label: 'ID', field: 'id', sortable: true },
  { name: 'producto', align: 'left', label: 'Producto', field: 'productoNombre', sortable: true },
  { name: 'cantidad', align: 'center', label: 'Cantidad', field: 'cantidad', sortable: true },
  { 
    name: 'tipo', 
    align: 'center', 
    label: 'Tipo', 
    field: 'tipo',
    sortable: true
  },
  { 
    name: 'fecha', 
    align: 'left', 
    label: 'Fecha', 
    field: 'fecha', 
    format: (val: string | number | Date | null | undefined) => val ? new Date(val).toLocaleString() : '',
    sortable: true 
  },
];

const cargarMovimientos = async () => {
  try {
    loading.value = true;
    error.value = null;

    const response = await api.get('transferencias');
    let transferencias: Transferencia[] = [];

    if (Array.isArray(response.data)) {
      transferencias = response.data as Transferencia[];
    } else if (response.data && typeof response.data === 'object' && 'items' in response.data) {
      const apiResp = response.data as ApiResponse;
      transferencias = apiResp.items || [];
    }

    // Mapear las transferencias a la interfaz Movimiento
    movimientos.value = transferencias.map((transferencia: Transferencia) => ({
      id: transferencia.id,
      productoNombre: transferencia.producto?.nombre || 'Producto desconocido',
      cantidad: Number(transferencia.cantidad),
      tipo: 'Transferencia',
      fecha: new Date(transferencia.fecha_transferencia)
    }));
  } catch (err) {
    console.error('Error al cargar movimientos:', err);
    error.value = 'Error al obtener los movimientos de inventario';
    $q.notify({
      message: 'Error al cargar movimientos',
      color: 'negative',
      icon: 'error'
    });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void cargarMovimientos();
});
</script>

<template>
  <q-page padding class="movimientos-page">
    <div class="header-section q-mb-lg">
      <div class="row items-center justify-between q-mb-md">
        <div>
          <h1 class="text-h4 text-weight-bold gradient-text q-mb-sm">Historial de Movimientos</h1>
          <p class="text-subtitle1 text-grey-8 q-my-none">
            Consulta el historial completo de transferencias de inventario.
          </p>
        </div>
        <q-btn 
          @click="cargarMovimientos" 
          label="Recargar" 
          icon="refresh" 
          color="amber-8" 
          :loading="loading"
          class="btn-recargar"
        />
      </div>
    </div>

    <!-- Tabla de movimientos con q-table -->
    <q-table
      :rows="movimientos"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :filter="filter"
      flat
      bordered
      class="movimientos-table"
      :pagination="{ rowsPerPage: 15 }"
      rows-per-page-label="Registros por página"
      :pagination-label="(start: number, end: number, total: number) => `${start}-${end} de ${total}`"
    >
      <template v-slot:top-right>
        <q-input borderless dense debounce="300" v-model="filter" placeholder="Buscar movimiento...">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
      </template>

      <template v-slot:body-cell-tipo="props">
        <q-td :props="props">
          <q-chip 
            outline 
            color="primary" 
            text-color="primary" 
            :label="props.value" 
            size="sm" 
            class="text-weight-bold"
          />
        </q-td>
      </template>

      <template v-slot:no-data>
        <div class="full-width row flex-center q-pa-xl text-grey-7">
          <q-icon name="info" size="md" color="grey-5" class="q-mr-sm" />
          <span>No hay movimientos registrados en este momento.</span>
        </div>
      </template>
    </q-table>

    <div v-if="error" class="error-message q-mt-md">
      {{ error }}
    </div>
  </q-page>
</template>

<style scoped>
.movimientos-page {
  background: transparent;
}

.gradient-text {
  background: var(--gradient-brand-135);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
}

.movimientos-table {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

:deep(.q-table th) {
  font-weight: 700;
  color: #5a3f2b;
  text-transform: uppercase;
  font-size: 0.85rem;
  padding: 12px 16px;
}

:deep(.q-table__bottom) {
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  color: #6d4c41;
  padding: 8px 16px;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #c33;
}

.btn-recargar {
  border-radius: 8px;
  font-weight: 600;
}
</style>
