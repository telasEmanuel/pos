<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import api from 'src/api/axios';
import { useQuasar } from 'quasar';
import InventoryManagerModal from 'src/components/InventoryManagerModal.vue';

interface InventarioItem {
  id: number;
  bodega_id: number;
  producto_id?: number;
  producto?: {
    id?: number;
    nombre: string;
    medida_ind?: string;
    medida?: string;
    inv_min?: number;
  };
  cantidad: number;
  inv_min?: number;
  medida_ind?: string;
  medida?: string;
}

const $q = useQuasar();
const loading = ref(false);
const inventario = ref<InventarioItem[]>([]);
const filter = ref('');
const showInventoryManager = ref(false);
const itemToEdit = ref<InventarioItem | null>(null);
const bodegaSeleccionada = ref<1 | 2>(1);

const columns: { name: string; align: 'left' | 'center' | 'right'; label: string; field: string | ((row: InventarioItem) => string | number); sortable?: boolean }[] = [
  { name: 'nombre', align: 'left', label: 'Producto', field: (row: InventarioItem) => row.producto?.nombre || 'Sin nombre', sortable: true },
  { name: 'cantidad', align: 'center', label: 'Existencia', field: 'cantidad', sortable: true },
  { name: 'inv_min', align: 'center', label: 'Mínimo', field: (row: InventarioItem) => row.inv_min ?? row.producto?.inv_min ?? 0, sortable: true },
  { name: 'unidad', align: 'left', label: 'Unidad', field: (row: InventarioItem) => row.medida_ind || row.medida || row.producto?.medida_ind || row.producto?.medida || '', sortable: true },
  { name: 'estado', align: 'center', label: 'Estado', field: 'id' },
  /*{ name: 'acciones', align: 'center', label: 'Acciones', field: 'id' }*/
];

const lowStockItems = computed(() => {
  return inventario.value.filter(item => {
    const min = item.inv_min ?? item.producto?.inv_min ?? 0;
    return item.cantidad < min && item.bodega_id === bodegaSeleccionada.value;
  });
});

const cargarInventario = async () => {
  loading.value = true;
  try {
    const res = await api.get('inventarios');
    inventario.value = (Array.isArray(res.data) ? res.data : (res.data.items ?? [])) as InventarioItem[];
  } catch (err) {
    console.error('Error cargando inventario:', err);
    $q.notify({
      message: 'Error al cargar el inventario',
      color: 'negative',
      icon: 'error'
    });
  } finally {
    loading.value = false;
  }
};

const editItem = (row: InventarioItem) => {
  itemToEdit.value = row;
  showInventoryManager.value = true;
};

onMounted(() => {
  void cargarInventario();
});
</script>

<template>
  <q-page padding class="reporte-page">
    <div class="header-section q-mb-lg">
      <div class="row items-center justify-between q-mb-md">
        <div>
          <h1 class="text-h4 text-weight-bold gradient-text q-mb-sm">Reporte de Existencias Bajas</h1>
          <p class="text-subtitle1 text-grey-8 q-my-none">
            Productos con existencia por debajo del nivel mínimo configurado.
          </p>
        </div>
        <div class="bodega-toggle">
          <q-btn-toggle v-model="bodegaSeleccionada" :options="[
            { label: 'Tienda', value: 1 },
            { label: 'Bodega', value: 2 }
          ]" color="amber-8" text-color="white" toggle-color="amber-9" />
        </div>
      </div>
    </div>

    <q-table :rows="lowStockItems" :columns="columns" row-key="id" :loading="loading" :filter="filter" flat bordered
      class="reporte-table" :pagination="{ rowsPerPage: 15 }" rows-per-page-label="Registros por página"
      :pagination-label="(start: number, end: number, total: number) => `${start}-${end} de ${total}`">
      <template v-slot:top-right>
        <q-input borderless dense debounce="300" v-model="filter" placeholder="Buscar producto...">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
        <q-btn flat round dense icon="refresh" @click="cargarInventario" class="q-ml-md" :loading="loading">
          <q-tooltip>Actualizar</q-tooltip>
        </q-btn>
      </template>

      <template v-slot:body-cell-cantidad="props">
        <q-td :props="props">
          <q-badge color="negative" class="q-pa-xs text-weight-bold">
            {{ props.value }}
          </q-badge>
        </q-td>
      </template>

      <template v-slot:body-cell-estado="props">
        <q-td :props="props">
          <q-chip outline color="negative" text-color="white" icon="warning" label="Reabastecer" size="sm" />
        </q-td>
      </template>

      <template v-slot:body-cell-acciones="props">
        <q-td :props="props">
          <q-btn flat round dense color="primary" icon="edit_note" @click="editItem(props.row)">
            <q-tooltip>Actualizar Stock</q-tooltip>
          </q-btn>
        </q-td>
      </template>

      <template v-slot:no-data>
        <div class="full-width row flex-center q-pa-xl text-grey-7">
          <q-icon name="check_circle" size="md" color="positive" class="q-mr-sm" />
          <span>Todas las existencias están en niveles óptimos.</span>
        </div>
      </template>
    </q-table>

    <InventoryManagerModal :show="showInventoryManager" :initial-item="itemToEdit"
      @close="() => { showInventoryManager = false; itemToEdit = null }" @updated="() => { void cargarInventario() }" />
  </q-page>
</template>

<style scoped>
.reporte-page {
  background: transparent;
}

.header-section {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

@media (max-width: 768px) {
  .bodega-toggle {
    margin-top: 1rem;
  }
}

.gradient-text {
  background: linear-gradient(135deg, #FFD54F 0%, #8B5E3C 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
}

.reporte-table {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.q-table__card {
  border-radius: 16px;
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

:deep(.q-table__control) {
  margin-left: 8px;
}

:deep(.q-field--standard .q-field__control:before) {
  border-bottom: none;
}
</style>
