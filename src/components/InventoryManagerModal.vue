<script setup lang="ts">
import { ref } from 'vue';
import api from 'src/api/axios';
import { useQuasar } from 'quasar';

interface InventarioItem {
  id: number;
  bodega_id: number;
  producto?: {
    nombre: string;
    inv_min?: number;
  };
  cantidad: number;
  inv_min?: number;
  medida_ind?: string;
}

const props = defineProps<{
  show: boolean;
  initialItem?: InventarioItem | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const $q = useQuasar();

// States: 'auth' | 'search' | 'update'
const currentState = ref<'auth' | 'search' | 'update'>('auth');

// Auth State
const password = ref('');
const isPwd = ref(true);

// Search State
const searchQuery = ref('');
const searchLoading = ref(false);
const searchResults = ref<InventarioItem[]>([]);

// Update State
const selectedItem = ref<InventarioItem | null>(null);
const newQuantity = ref<number>(0);
const updateLoading = ref(false);

const selectItem = (item: InventarioItem) => {
  selectedItem.value = item;
  newQuantity.value = item.cantidad;
  currentState.value = 'update';
};

const checkPassword = () => {
  if (password.value === import.meta.env.VITE_PASSWORD) {
    if (props.initialItem) {
      selectItem(props.initialItem);
    } else {
      currentState.value = 'search';
    }
    password.value = '';
  } else {
    $q.notify({
      message: 'Contraseña incorrecta',
      color: 'negative',
      icon: 'lock'
    });
  }
};

const handleSearch = async () => {
  if (!searchQuery.value.trim()) return;
  searchLoading.value = true;
  try {
    const res = await api.get('inventarios');
    const items = (Array.isArray(res.data) ? res.data : (res.data.items ?? [])) as InventarioItem[];

    // Filter by bodega_id: 1 (Tienda) and name/id
    const query = searchQuery.value.toLowerCase();
    searchResults.value = items.filter((item: InventarioItem) =>
      item.bodega_id === 1 && (
        item.producto?.nombre?.toLowerCase().includes(query) ||
        item.id.toString().includes(query)
      )
    );
  } catch (err) {
    console.error('Error searching inventory:', err);
  } finally {
    searchLoading.value = false;
  }
};

const updateStock = async () => {
  if (!selectedItem.value) return;
  updateLoading.value = true;
  try {
    await api.put(`inventarios/${selectedItem.value.id}`, {
      cantidad: newQuantity.value
    });

    $q.notify({
      message: 'Stock actualizado correctamente',
      color: 'positive',
      icon: 'check'
    });

    emit('updated');
    resetAndClose();
  } catch (err) {
    console.error('Error updating stock:', err);
    $q.notify({
      message: 'Error al actualizar el stock',
      color: 'negative',
      icon: 'error'
    });
  } finally {
    updateLoading.value = false;
  }
};

const resetAndClose = () => {
  currentState.value = 'auth';
  password.value = '';
  searchQuery.value = '';
  searchResults.value = [];
  selectedItem.value = null;
  emit('close');
};

const backToSearch = () => {
  currentState.value = 'search';
  selectedItem.value = null;
};
</script>

<template>
  <q-dialog :model-value="show" @hide="resetAndClose" persistent>
    <q-card style="min-width: 400px; border-radius: 20px;" class="inventory-manager-card">
      <q-card-section class="row items-center q-pb-none bg-gradient">
        <div class="text-h6 text-white font-weight-bold">
          <q-icon name="inventory" class="q-mr-sm" />
          Gestión de Inventario
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup color="white" />
      </q-card-section>

      <q-card-section class="q-pt-lg">
        <!-- AUTH STATE -->
        <div v-if="currentState === 'auth'" class="column items-center q-gutter-md">
          <div class="text-subtitle1 text-grey-8 q-mb-sm">Acceso Restringido</div>
          <div class="full-width column items-center" style="max-width: 320px;">
            <q-input v-model="password" filled :type="isPwd ? 'password' : 'text'" label="Contraseña de Gerente"
              class="full-width q-mb-md" color="brown-5" autofocus @keyup.enter="checkPassword">
              <template v-slot:append>
                <q-icon :name="isPwd ? 'visibility_off' : 'visibility'" class="cursor-pointer"
                  @click="isPwd = !isPwd" />
              </template>
            </q-input>
            <q-btn label="Entrar" class="full-width rounded-btn shadow-2 btn-gold" @click="checkPassword" />
          </div>
        </div>

        <!-- SEARCH STATE -->
        <div v-if="currentState === 'search'" class="column q-gutter-md">
          <q-input v-model="searchQuery" filled placeholder="Buscar producto..." dense debounce="300"
            @update:model-value="handleSearch" autofocus>
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>

          <q-scroll-area style="height: 300px;" class="rounded-borders border-grey">
            <q-list separator>
              <q-item v-if="searchLoading" class="flex-center q-pa-lg">
                <q-spinner-dots color="yellow-13" size="lg" />
              </q-item>
              <q-item v-else-if="searchResults.length === 0 && searchQuery" class="text-grey-6 text-center q-pa-md">
                No se encontraron productos
              </q-item>

              <q-item v-for="item in searchResults" :key="item.id" clickable v-ripple @click="selectItem(item)">
                <q-item-section>
                  <q-item-label class="text-weight-bold">{{ item.producto?.nombre }}</q-item-label>
                  <q-item-label caption>
                    ID: {{ item.id }} | Bodega: {{ item.bodega_id === 1 ? 'Tienda' : '' }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge :color="item.cantidad < (item.inv_min || 5) ? 'negative' : 'positive'">
                    {{ item.cantidad }} {{ item.medida_ind || '' }}
                  </q-badge>
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>
        </div>

        <!-- UPDATE STATE -->
        <div v-if="currentState === 'update' && selectedItem" class="column q-gutter-md">
          <div class="row items-center q-mb-sm">
            <q-btn icon="arrow_back" flat round dense @click="backToSearch" class="q-mr-sm" />
            <div class="text-subtitle1 text-weight-bold">{{ selectedItem.producto?.nombre }}</div>
          </div>

          <div class="row q-col-gutter-md">
            <div class="col-6">
              <q-field label="Existencia Actual" stack-label filled readonly>
                <template v-slot:control>
                  <div class="self-center full-width no-outline" tabindex="0">{{ selectedItem.cantidad
                    }}</div>
                </template>
              </q-field>
            </div>
            <div class="col-6">
              <q-input v-model.number="newQuantity" type="number" label="Nueva Cantidad" filled autofocus
                @keyup.enter="updateStock" />
            </div>
          </div>

          <q-btn label="Actualizar Stock" color="positive" class="full-width rounded-btn q-mt-md"
            :loading="updateLoading" @click="updateStock" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.bg-gradient {
  background: linear-gradient(135deg, #FFD54F 0%, #8B5E3C 100%);
}

.btn-gold {
  background: linear-gradient(90deg, #FFD54F 0%, #8B5E3C 100%) !important;
  color: white !important;
}

.rounded-btn {
  border-radius: 12px;
  height: 48px;
}

.border-grey {
  border: 1px solid #e0e0e0;
}

.inventory-manager-card {
  overflow: hidden;
}

.text-white {
  color: white !important;
}

:deep(.q-field--filled .q-field__control) {
  border-radius: 12px;
}
</style>
