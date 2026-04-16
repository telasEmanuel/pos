<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import api from 'src/api/axios';
import { useQuasar } from 'quasar';
import InventoryManagerModal from 'src/components/InventoryManagerModal.vue';
import * as XLSX from 'xlsx';

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

interface ComparativaItem {
  producto_id: number;
  nombre: string;
  inv_bodega: number;
  inv_tienda: number;
  medida: string;
  seleccionado: boolean;
}

const $q = useQuasar();
const loading = ref(false);
const inventario = ref<InventarioItem[]>([]);
const filter = ref('');
const filterComparativa = ref('');
const showInventoryManager = ref(false);
const itemToEdit = ref<InventarioItem | null>(null);
const bodegaSeleccionada = ref<1 | 2 | 3>(1);
const comparativaItems = ref<ComparativaItem[]>([]);

const columns: { name: string; align: 'left' | 'center' | 'right'; label: string; field: string | ((row: InventarioItem) => string | number); sortable?: boolean }[] = [
  { name: 'nombre', align: 'left', label: 'Producto', field: (row: InventarioItem) => row.producto?.nombre || 'Sin nombre', sortable: true },
  { name: 'cantidad', align: 'center', label: 'Existencia', field: 'cantidad', sortable: true },
  { name: 'inv_min', align: 'center', label: 'Mínimo', field: (row: InventarioItem) => row.inv_min ?? row.producto?.inv_min ?? 0, sortable: true },
  { name: 'unidad', align: 'left', label: 'Unidad', field: (row: InventarioItem) => row.medida_ind || row.medida || row.producto?.medida_ind || row.producto?.medida || '', sortable: true },
  { name: 'estado', align: 'center', label: 'Estado', field: 'id' },
];

const comparativaColumns = [
  { name: 'seleccionar', align: 'center' as const, label: '', field: 'seleccionado' },
  { name: 'nombre', align: 'left' as const, label: 'PRODUCTO', field: 'nombre' },
  { name: 'inv_bodega', align: 'center' as const, label: 'INV. BOD.', field: 'inv_bodega' },
  { name: 'inv_tienda', align: 'center' as const, label: 'INV. TIE.', field: 'inv_tienda' }
];

const lowStockItems = computed(() => {
  return inventario.value.filter(item => {
    const min = item.inv_min ?? item.producto?.inv_min ?? 0;
    return item.cantidad < min && item.bodega_id === 1;
  });
});

const bodegaItems = computed(() => {
  return inventario.value.filter(item => {
    const min = item.inv_min ?? item.producto?.inv_min ?? 0;
    return item.cantidad < min && item.bodega_id === 2;
  });
});

const comparativaItemsFiltrados = computed(() => {
  if (!filterComparativa.value) {
    return comparativaItems.value;
  }
  const searchLower = filterComparativa.value.toLowerCase();
  return comparativaItems.value.filter(item =>
    item.nombre.toLowerCase().includes(searchLower)
  );
});

const cargarInventario = async () => {
  loading.value = true;
  try {
    const res = await api.get('inventarios');
    inventario.value = (Array.isArray(res.data) ? res.data : (res.data.items ?? [])) as InventarioItem[];
    generarComparativa();
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

const generarComparativa = () => {
  const productoMap = new Map<number, ComparativaItem>();

  // Procesar todos los inventarios
  inventario.value.forEach(item => {
    const productoId = item.producto_id!;
    const nombre = item.producto?.nombre || `Producto #${productoId}`;
    const medida = item.medida_ind || item.medida || item.producto?.medida_ind || item.producto?.medida || 'pieza';

    if (!productoMap.has(productoId)) {
      productoMap.set(productoId, {
        producto_id: productoId,
        nombre,
        inv_bodega: 0,
        inv_tienda: 0,
        medida,
        seleccionado: false
      });
    }

    const item_data = productoMap.get(productoId)!;
    if (item.bodega_id === 2) {
      item_data.inv_bodega = item.cantidad;
    } else if (item.bodega_id === 1) {
      item_data.inv_tienda = item.cantidad;
    }
  });

  comparativaItems.value = Array.from(productoMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
};

const toggleTodoComparativa = (valor: boolean) => {
  comparativaItemsFiltrados.value.forEach(item => {
    item.seleccionado = valor;
  });
};

const exportarComparativa = () => {
  const seleccionados = comparativaItems.value.filter(item => item.seleccionado);

  if (seleccionados.length === 0) {
    $q.notify({
      message: 'Por favor selecciona al menos un producto',
      color: 'warning',
      icon: 'info'
    });
    return;
  }

  const datos = seleccionados.map(item => ({
    'Nombre del Producto': item.nombre,
    'Inventario Bodega': item.inv_bodega,
    'Inventario Tienda': item.inv_tienda,
    'Medida': item.medida
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comparativa');

  // Ajustar ancho de columnas
  ws['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 }
  ];

  XLSX.writeFile(wb, `comparativa_inventario_${new Date().toISOString().split('T')[0]}.xlsx`);

  $q.notify({
    message: `Exportados ${seleccionados.length} producto(s)`,
    color: 'positive',
    icon: 'check'
  });
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
          <h1 class="text-h4 text-weight-bold gradient-text q-mb-sm">Reporte de Existencias</h1>
          <p class="text-subtitle1 text-grey-8 q-my-none">
            Consulta el inventario por stock bajo en tienda, bodega o comparativa entre ambas.
          </p>
        </div>
        <div class="bodega-toggle">
          <q-btn-toggle v-model="bodegaSeleccionada" :options="[
            { label: 'Tienda', value: 1 },
            { label: 'Bodega', value: 2 },
            { label: 'Comparativa', value: 3 }
          ]" color="amber-8" text-color="white" toggle-color="amber-9" />
        </div>
      </div>
    </div>

    <!-- Vista: Tienda -->
    <div v-show="bodegaSeleccionada === 1">
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

        <template v-slot:no-data>
          <div class="full-width row flex-center q-pa-xl text-grey-7">
            <q-icon name="check_circle" size="md" color="positive" class="q-mr-sm" />
            <span>Todas las existencias están en niveles óptimos.</span>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Vista: Bodega -->
    <div v-show="bodegaSeleccionada === 2">
      <q-table :rows="bodegaItems" :columns="columns" row-key="id" :loading="loading" :filter="filter" flat bordered
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

        <template v-slot:no-data>
          <div class="full-width row flex-center q-pa-xl text-grey-7">
            <q-icon name="inbox" size="md" color="warning" class="q-mr-sm" />
            <span>Sin inventario en bodega.</span>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Vista: Comparativa -->
    <div v-show="bodegaSeleccionada === 3" class="comparativa-section">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-subtitle2 text-grey-7">
          <strong>{{comparativaItems.filter(i => i.seleccionado).length}}</strong> producto(s) seleccionado(s)
        </div>
        <div class="row q-gutter-sm items-center">
          <q-input v-model="filterComparativa" outlined dense placeholder="Buscar producto..." style="min-width: 250px">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
          <q-btn flat size="sm" label="Seleccionar Todo" icon="done_all" color="primary"
            @click="toggleTodoComparativa(true)" />
          <q-btn flat size="sm" label="Deseleccionar Todo" icon="clear" color="grey-7"
            @click="toggleTodoComparativa(false)" />
          <q-btn flat size="sm" label="Exportar a Excel" icon="download" color="positive" @click="exportarComparativa"
            :disable="comparativaItems.filter(i => i.seleccionado).length === 0" />
          <q-btn flat round dense icon="refresh" @click="cargarInventario" :loading="loading">
            <q-tooltip>Actualizar</q-tooltip>
          </q-btn>
        </div>
      </div>

      <q-table :rows="comparativaItemsFiltrados" :columns="comparativaColumns" row-key="producto_id" :loading="loading"
        flat bordered class="reporte-table" :pagination="{ rowsPerPage: 20 }" rows-per-page-label="Registros por página"
        :pagination-label="(start: number, end: number, total: number) => `${start}-${end} de ${total}`">
        <template v-slot:body-cell-seleccionar="props">
          <q-td :props="props">
            <q-checkbox v-model="props.row.seleccionado" />
          </q-td>
        </template>

        <template v-slot:body-cell-inv_bodega="props">
          <q-td :props="props">
            <q-badge color="blue" :label="`${props.value}`" text-color="white" class="text-weight-bold" />
          </q-td>
        </template>

        <template v-slot:body-cell-inv_tienda="props">
          <q-td :props="props">
            <q-badge color="orange" :label="`${props.value}`" text-color="white" class="text-weight-bold" />
          </q-td>
        </template>

        <template v-slot:no-data>
          <div class="full-width row flex-center q-pa-xl text-grey-7">
            <q-icon name="layers_clear" size="md" color="warning" class="q-mr-sm" />
            <span>Sin datos de inventario.</span>
          </div>
        </template>
      </q-table>
    </div>

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

.comparativa-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  padding: 16px;
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .bodega-toggle {
    margin-top: 1rem;
  }
}

.gradient-text {
  background: var(--gradient-brand-135);
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
