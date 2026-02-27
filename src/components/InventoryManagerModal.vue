<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import api from 'src/api/axios';
import { useQuasar } from 'quasar';

interface Producto {
  id?: number;
  nombre: string;
  precio?: number;
  precio_tap?: number;
  categoria_id?: number;
}

interface InventarioItem {
  id: number;
  bodega_id: number;
  producto?: Producto;
  producto_id?: number;
  cantidad: number;
  inv_min?: number;
  medida_ind?: string;
}

interface Categoria {
  id: number;
  nombre: string;
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

// States: 'auth' | 'search' | 'update' | 'create'
const currentState = ref<'auth' | 'search' | 'update' | 'create'>('auth');
const editMode = ref<'quantity' | 'product' | 'prices' | 'inv_min' | null>(null);

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
const newProductName = ref('');
const newPrecio = ref(0);
const newPrecioTap = ref(0);
const newInvMin = ref<number>(0);
const updateLoading = ref(false);
const deleteLoading = ref(false);

// Preview state
const showPreview = ref(false);
const previewChanges = ref<Record<string, { anterior: unknown; nuevo: unknown }>>({});

// Create State
const categories = ref<Categoria[]>([]);
const createForm = ref({
  nombre: '',
  descripcion: '',
  precio: 0.00,
  precio_tap: 0.00,
  categoria_id: null as number | null,
  cantidad: 1
});
const createLoading = ref(false);

const selectItem = (item: InventarioItem) => {
  console.log('📦 Item seleccionado:', {
    id: item.id,
    cantidad: item.cantidad,
    inv_min: item.inv_min,
    producto: item.producto?.nombre
  });

  selectedItem.value = item;
  newQuantity.value = item.cantidad;
  newProductName.value = item.producto?.nombre || '';
  newPrecio.value = item.producto?.precio || 0;
  newPrecioTap.value = item.producto?.precio_tap || 0;
  newInvMin.value = item.inv_min || 5;
  editMode.value = null;
  showPreview.value = false;
  currentState.value = 'update';

  console.log('✅ Valores inicializados - newInvMin:', newInvMin.value);
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

  // Validaciones
  if (newQuantity.value < 0) {
    $q.notify({
      message: 'La cantidad no puede ser negativa',
      color: 'warning',
      icon: 'warning'
    });
    return;
  }

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
    resetToSearch();
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

const updateProduct = async () => {
  console.log('🔄 updateProduct llamada con editMode:', editMode.value);

  if (!selectedItem.value?.producto?.id) return;

  // Validaciones
  if (editMode.value === 'product' && !newProductName.value.trim()) {
    $q.notify({
      message: 'El nombre del producto no puede estar vacío',
      color: 'warning',
      icon: 'warning'
    });
    return;
  }

  if (editMode.value === 'prices') {
    if (newPrecio.value < 0 || newPrecioTap.value < 0) {
      $q.notify({
        message: 'Los precios no pueden ser negativos',
        color: 'warning',
        icon: 'warning'
      });
      return;
    }
  }

  updateLoading.value = true;
  try {
    const updateData: Record<string, number | string> = {};

    if (editMode.value === 'product') {
      updateData.nombre = newProductName.value;
    } else if (editMode.value === 'prices') {
      updateData.precio = parseFloat(newPrecio.value.toString());
      updateData.precio_tap = parseFloat(newPrecioTap.value.toString());
    } else if (editMode.value === 'inv_min') {
      console.log('🔧 Actualizando inv_min:', {
        inventarioId: selectedItem.value.id,
        valorAnterior: selectedItem.value.inv_min,
        valorNuevo: newInvMin.value
      });

      if (newInvMin.value < 0) {
        $q.notify({
          message: 'La cantidad mínima no puede ser negativa',
          color: 'warning',
          icon: 'warning'
        });
        updateLoading.value = false;
        return;
      }

      try {
        const response = await api.put(`inventarios/${selectedItem.value.id}`, {
          inv_min: newInvMin.value
        });
        console.log('✅ Respuesta del servidor:', response.data);

        $q.notify({
          message: 'Cantidad mínima actualizada correctamente',
          color: 'positive',
          icon: 'check'
        });
        emit('updated');
        resetToSearch();
      } catch (error) {
        console.error('❌ Error actualizando inv_min:', error);
        $q.notify({
          message: 'Error al actualizar la cantidad mínima',
          color: 'negative',
          icon: 'error'
        });
      } finally {
        updateLoading.value = false;
      }
      return;
    }

    await api.put(`productos/${selectedItem.value.producto.id}`, updateData);

    $q.notify({
      message: 'Producto actualizado correctamente',
      color: 'positive',
      icon: 'check'
    });

    emit('updated');
    resetToSearch();
  } catch (err) {
    console.error('Error updating product:', err);
    $q.notify({
      message: 'Error al actualizar el producto',
      color: 'negative',
      icon: 'error'
    });
  } finally {
    updateLoading.value = false;
  }
};

const deleteProduct = () => {
  console.log('🗑️ deleteProduct llamada');
  console.log('📦 selectedItem:', selectedItem.value);

  // Usar producto_id en lugar de producto.id
  const productoId = selectedItem.value?.producto_id || selectedItem.value?.producto?.id;

  if (!productoId) {
    console.log('❌ No hay producto seleccionado o no tiene ID');
    $q.notify({
      message: 'No se pudo identificar el producto a eliminar',
      color: 'negative',
      icon: 'error'
    });
    return;
  }

  console.log('✅ ID del producto a eliminar:', productoId);
  console.log('📝 Tipo de ID:', typeof productoId);

  $q.dialog({
    title: 'Confirmar eliminación',
    message: `¿Estás seguro de que deseas eliminar este producto?\n\nID: ${productoId}\n\nEsta acción no se puede deshacer.`,
    cancel: true,
    persistent: true,
    html: true
  }).onOk(() => {
    console.log('💾 Usuario confirmó eliminación');
    deleteLoading.value = true;
    console.log('🔧 Llamando a DELETE /productos/' + productoId);

    api.delete(`productos/${productoId}`).then((response) => {
      console.log('✅ Respuesta del servidor:', response.data);

      $q.notify({
        message: 'Producto eliminado correctamente',
        color: 'positive',
        icon: 'check'
      });

      emit('updated');
      resetToSearch();
    }).catch((err) => {
      console.error('❌ Error eliminando producto:', err);
      console.error('📝 Detalles del error:', {
        response: err.response?.data,
        status: err.response?.status,
        message: err.message
      });

      $q.notify({
        message: err.response?.data?.error || 'Error al eliminar el producto',
        color: 'negative',
        icon: 'error'
      });
    }).finally(() => {
      console.log('🏁 Finalizando proceso de eliminación');
      deleteLoading.value = false;
    });
  }).onCancel(() => {
    console.log('❌ Usuario canceló la eliminación');
  });
};

const generatePreview = () => {
  console.log('🔍 Generando preview, editMode:', editMode.value);
  console.log('📊 Valores actuales:', {
    cantidad: selectedItem.value?.cantidad,
    inv_min: selectedItem.value?.inv_min,
    newQuantity: newQuantity.value,
    newInvMin: newInvMin.value
  });

  previewChanges.value = {};

  if (editMode.value === 'quantity') {
    if (newQuantity.value !== selectedItem.value?.cantidad) {
      previewChanges.value.cantidad = {
        anterior: selectedItem.value?.cantidad,
        nuevo: newQuantity.value
      };
    }
  } else if (editMode.value === 'inv_min') {
    if (newInvMin.value !== selectedItem.value?.inv_min) {
      previewChanges.value.inv_min = {
        anterior: selectedItem.value?.inv_min || 5,
        nuevo: newInvMin.value
      };
    }
  } else if (editMode.value === 'product') {
    if (newProductName.value !== selectedItem.value?.producto?.nombre) {
      previewChanges.value.nombre = {
        anterior: selectedItem.value?.producto?.nombre,
        nuevo: newProductName.value
      };
    }
  } else if (editMode.value === 'prices') {
    if (newPrecio.value !== selectedItem.value?.producto?.precio) {
      previewChanges.value.precio = {
        anterior: selectedItem.value?.producto?.precio,
        nuevo: newPrecio.value
      };
    }
    if (newPrecioTap.value !== selectedItem.value?.producto?.precio_tap) {
      previewChanges.value.precio_tap = {
        anterior: selectedItem.value?.producto?.precio_tap,
        nuevo: newPrecioTap.value
      };
    }
  }

  console.log('✨ Preview generado:', previewChanges.value);
  showPreview.value = true;
};

const crearProducto = async () => {
  // Validaciones
  if (!createForm.value.nombre.trim()) {
    $q.notify({
      message: 'El nombre del producto es requerido',
      color: 'warning',
      icon: 'warning'
    });
    return;
  }

  if (!createForm.value.categoria_id) {
    $q.notify({
      message: 'Debe seleccionar una categoría',
      color: 'warning',
      icon: 'warning'
    });
    return;
  }

  if (createForm.value.precio < 0 || createForm.value.precio_tap < 0) {
    $q.notify({
      message: 'Los precios no pueden ser negativos',
      color: 'warning',
      icon: 'warning'
    });
    return;
  }

  if (createForm.value.cantidad < 1) {
    $q.notify({
      message: 'La cantidad inicial debe ser mayor a 0',
      color: 'warning',
      icon: 'warning'
    });
    return;
  }

  createLoading.value = true;
  try {
    // Crear producto
    const productoRes = await api.post('productos', {
      nombre: createForm.value.nombre,
      descripcion: createForm.value.descripcion,
      precio: parseFloat(createForm.value.precio.toString()),
      precio_tap: parseFloat(createForm.value.precio_tap.toString()),
      categoria_id: createForm.value.categoria_id
    });

    const nuevoProducto = productoRes.data;

    // Crear inventario para bodega 1 (Tienda)
    await api.post('inventarios', {
      producto_id: nuevoProducto.id,
      bodega_id: 1,
      cantidad: createForm.value.cantidad,
      inv_min: 5
    });

    $q.notify({
      message: 'Producto creado correctamente',
      color: 'positive',
      icon: 'check'
    });

    emit('updated');
    resetToSearch();
  } catch (err) {
    console.error('Error creating product:', err);
    $q.notify({
      message: 'Error al crear el producto',
      color: 'negative',
      icon: 'error'
    });
  } finally {
    createLoading.value = false;
  }
};

const resetToSearch = () => {
  currentState.value = 'search';
  searchQuery.value = '';
  searchResults.value = [];
  selectedItem.value = null;
  editMode.value = null;
  showPreview.value = false;
  createForm.value = {
    nombre: '',
    descripcion: '',
    precio: 0.00,
    precio_tap: 0.00,
    categoria_id: null,
    cantidad: 1
  };
};

const resetAndClose = () => {
  currentState.value = 'auth';
  password.value = '';
  resetToSearch();
  emit('close');
};

const backToSearch = () => {
  currentState.value = 'search';
  selectedItem.value = null;
  editMode.value = null;
};

const goToCreate = () => {
  currentState.value = 'create';
};

const backFromCreate = () => {
  currentState.value = 'search';
  createForm.value = {
    nombre: '',
    descripcion: '',
    precio: 0.00,
    precio_tap: 0.00,
    categoria_id: null,
    cantidad: 1
  };
};

onMounted(async () => {
  try {
    const res = await api.get('categorias');
    categories.value = Array.isArray(res.data) ? res.data : (res.data.items ?? []);
  } catch (err) {
    console.error('Error loading categories:', err);
  }
});

// Watch para resetear el estado cuando se abre el modal
watch(() => props.show, (newValue, oldValue) => {
  // Cuando el modal se abre (cambia de false a true)
  if (newValue && !oldValue) {
    console.log('🔓 Modal abierto - reseteando a estado de autenticación');
    currentState.value = 'auth';
    password.value = '';
    searchQuery.value = '';
    searchResults.value = [];
    selectedItem.value = null;
    editMode.value = null;
    showPreview.value = false;
    createForm.value = {
      nombre: '',
      descripcion: '',
      precio: 0.00,
      precio_tap: 0.00,
      categoria_id: null,
      cantidad: 1
    };
  }
});

const formatLabel = (key: string): string => {
  const labels: Record<string, string> = {
    cantidad: 'Cantidad',
    inv_min: 'Cantidad Mínima',
    nombre: 'Nombre',
    precio: 'Precio Público',
    precio_tap: 'Precio Tapicero'
  };
  return labels[key] || key;
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && (value.toString().includes('.') || value > 100)) {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
};
</script>

<template>
  <q-dialog :model-value="show" @hide="resetAndClose" persistent>
    <q-card style="min-width: 480px; border-radius: 20px;" class="inventory-manager-card">
      <q-card-section class="row items-center justify-between q-pb-none bg-gradient">
        <div class="text-h6 text-white font-weight-bold">
          <q-icon name="inventory" class="q-mr-sm" />
          Gestión de Inventario
        </div>
        <q-btn icon="close" flat round dense v-close-popup color="white" />
      </q-card-section>

      <q-card-section class="q-pt-lg flex flex-center">
        <div style="width: 100%; max-width: 400px;">
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

            <q-btn label="Crear Nuevo Producto" icon="add" class="full-width rounded-btn btn-gold q-mb-sm"
              @click="goToCreate" />

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

            <!-- Edit Mode Selector -->
            <div v-if="!editMode" class="column q-gutter-sm">
              <p class="text-grey-7 q-mb-md text-center text-caption">Selecciona qué deseas editar:</p>

              <q-btn label="Editar Cantidad de Stock" icon="inventory_2" color="info" outline class="rounded-btn"
                @click="editMode = 'quantity'" />
              <q-btn label="Editar Nombre" icon="edit" color="warning" outline class="rounded-btn"
                @click="editMode = 'product'" />
              <q-btn label="Editar Precios" icon="price_change" color="positive" outline class="rounded-btn"
                @click="editMode = 'prices'" />
              <q-btn label="Editar Mín. de Inventario" icon="low_priority" color="purple" outline class="rounded-btn"
                @click="() => { console.log('🎯 Click en Editar Mín. Inventario'); editMode = 'inv_min'; console.log('✅ editMode ahora es:', editMode); }" />

              <q-separator class="q-my-sm" />

              <q-btn label="Eliminar Producto" icon="delete" color="negative" outline class="rounded-btn"
                :loading="deleteLoading" @click="deleteProduct" />
            </div>

            <!-- Quantity Edit Mode -->
            <div v-if="editMode === 'quantity'" class="column q-gutter-md">
              <div class="row q-col-gutter-md">
                <div class="col-6">
                  <q-field label="Existencia Actual" stack-label filled readonly>
                    <template v-slot:control>
                      <div class="self-center full-width no-outline" tabindex="0">{{ selectedItem.cantidad }}</div>
                    </template>
                  </q-field>
                </div>
                <div class="col-6">
                  <q-input v-model.number="newQuantity" type="number" label="Nueva Cantidad" filled autofocus
                    @keyup.enter="generatePreview" />
                </div>
              </div>

              <!--<div class="row q-col-gutter-md">
                <div class="col-12">
                  <q-input v-model.number="newInvMin" type="number" label="Cantidad Mínima" filled
                    @keyup.enter="generatePreview" />
                </div>
              </div>-->

              <div class="row q-gutter-md">
                <q-btn label="Cancelar" flat color="grey" class="col rounded-btn" @click="editMode = null" />
                <q-btn label="Vista Previa" class="col rounded-btn btn-gold-preview" @click="generatePreview" />
              </div>
            </div>

            <!-- Product Name Edit Mode -->
            <div v-if="editMode === 'product'" class="column q-gutter-md">
              <q-input v-model="newProductName" label="Nombre del Producto" filled autofocus dense
                @keyup.enter="generatePreview" />

              <div class="row q-gutter-md">
                <q-btn label="Cancelar" flat color="grey" class="col rounded-btn" @click="editMode = null" />
                <q-btn label="Vista Previa" class="col rounded-btn btn-gold-preview" @click="generatePreview" />
              </div>
            </div>

            <!-- Prices Edit Mode -->
            <div v-if="editMode === 'prices'" class="column q-gutter-md">
              <q-input v-model.number="newPrecio" type="number" step="0.01" label="Precio Público" filled autofocus
                dense />
              <q-input v-model.number="newPrecioTap" type="number" step="0.01" label="Precio Tapicero" filled dense />

              <div class="row q-gutter-md">
                <q-btn label="Cancelar" flat color="grey" class="col rounded-btn" @click="editMode = null" />
                <q-btn label="Vista Previa" class="col rounded-btn btn-gold-preview" @click="generatePreview" />
              </div>
            </div>

            <!-- Inv Min Edit Mode -->
            <div v-if="editMode === 'inv_min'" class="column q-gutter-md">
              <q-field label="Cantidad Mínima Actual" stack-label filled readonly>
                <template v-slot:control>
                  <div class="self-center full-width no-outline" tabindex="0">{{ selectedItem.inv_min || 5 }}</div>
                </template>
              </q-field>

              <q-input v-model.number="newInvMin" type="number" label="Nueva Cantidad Mínima" filled autofocus
                @keyup.enter="generatePreview" />

              <div class="row q-gutter-md">
                <q-btn label="Cancelar" flat color="grey" class="col rounded-btn" @click="editMode = null" />
                <q-btn label="Vista Previa" class="col rounded-btn btn-gold-preview" @click="generatePreview" />
              </div>
            </div>

            <!-- Preview Section -->
            <div v-if="showPreview && Object.keys(previewChanges).length > 0"
              class="column q-gutter-md q-pa-md rounded-borders bg-gold-light border-gold">
              <div class="text-subtitle2 text-weight-bold text-gold-dark">✓ Vista Previa de Cambios:</div>

              <div v-for="(change, key) in previewChanges" :key="key" class="row items-center q-gutter-md">
                <div class="col-4 text-caption text-weight-bold text-grey-7">{{ formatLabel(key) }}:</div>
                <div class="col-4 text-caption">
                  <span class="text-weight-bold text-negative">{{ formatValue(change.anterior) }}</span>
                  <q-icon name="arrow_forward" size="xs" class="q-mx-sm" />
                  <span class="text-weight-bold text-positive">{{ formatValue(change.nuevo) }}</span>
                </div>
              </div>

              <div class="row q-gutter-md q-mt-md">
                <q-btn label="Atrás" flat color="grey" class="col rounded-btn" @click="showPreview = false" />
                <q-btn label="Guardar Cambios" color="positive" class="col rounded-btn" :loading="updateLoading"
                  @click="() => { console.log('💾 Guardando cambios - editMode:', editMode); updateStock(); }"
                  v-if="editMode === 'quantity'" />
                <q-btn label="Guardar Cambios" color="positive" class="col rounded-btn" :loading="updateLoading"
                  @click="() => { console.log('💾 Guardando cambios (else) - editMode:', editMode); updateProduct(); }"
                  v-else />
              </div>
            </div>
          </div>

          <!-- CREATE STATE -->
          <div v-if="currentState === 'create'" class="column q-gutter-md">
            <div class="row items-center q-mb-md">
              <q-btn icon="arrow_back" flat round dense @click="backFromCreate" class="q-mr-sm" />
              <div class="text-subtitle1 text-weight-bold">Crear Nuevo Producto</div>
            </div>

            <q-scroll-area style="height: 350px;" class="rounded-borders border-grey q-pa-md">
              <div class="column q-gutter-md">
                <q-input v-model="createForm.nombre" label="Nombre del Producto" filled dense autofocus />

                <q-input v-model="createForm.descripcion" label="Descripción (opcional)" filled dense type="textarea"
                  rows="2" />

                <q-input v-model.number="createForm.precio" label="Precio Público" type="number" step="0.01" filled
                  dense />

                <q-input v-model.number="createForm.precio_tap" label="Precio Tapicero" type="number" step="0.01" filled
                  dense />

                <q-select v-model="createForm.categoria_id" :options="categories" option-value="id"
                  option-label="nombre" label="Categoría" filled dense emit-value map-options />

                <q-input v-model.number="createForm.cantidad" label="Cantidad Inicial" type="number" min="1" filled
                  dense />
              </div>
            </q-scroll-area>

            <q-btn label="Crear Producto" icon="check" class="full-width rounded-btn q-mt-md btn-gold"
              :loading="createLoading" @click="crearProducto" />
          </div>
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

.border-gold {
  border: 2px solid #FFD54F;
}

.bg-gold-light {
  background-color: #FFF9E6;
}

.text-gold-dark {
  color: #8B5E3C;
}

.btn-gold-preview {
  background: linear-gradient(90deg, #FFD54F 0%, #8B5E3C 100%) !important;
  color: white !important;
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

.text-negative {
  color: #c41c3b;
  text-decoration: line-through;
}

.text-positive {
  color: #21ba45;
  font-weight: bold;
}
</style>
