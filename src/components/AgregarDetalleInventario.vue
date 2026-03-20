<script setup lang="ts">
import { ref, watch } from 'vue'
import api from 'src/api/axios'

interface InventarioDetalle {
  id?: number
  inventario_id: number
  cantidad: number | string
  estado: string
  codigo?: string
}

interface Props {
  visible: boolean
  inventarioId: number
  medidaInd: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  detalleCreado: [detalle: InventarioDetalle]
}>()

const form = ref<InventarioDetalle>({
  inventario_id: props.inventarioId,
  cantidad: 0,
  estado: 'DISPONIBLE',
  codigo: ''
})

const isLoading = ref(false)
const formError = ref<string | null>(null)

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      form.value = {
        inventario_id: props.inventarioId,
        cantidad: 0,
        estado: 'DISPONIBLE',
        codigo: ''
      }
      formError.value = null
    }
  }
)

const guardarDetalle = async () => {
  formError.value = null

  // Validaciones
  if (!form.value.cantidad || Number(form.value.cantidad) <= 0) {
    formError.value = 'La cantidad debe ser mayor a 0'
    return
  }

  isLoading.value = true

  try {
    const payload = {
      inventario_id: props.inventarioId,
      cantidad: Number(form.value.cantidad),
      estado: form.value.estado,
      codigo: form.value.codigo || undefined
    }

    const response = await api.post('inventarios/detalles', payload)
    emit('detalleCreado', response.data)
    cerrar()
  } catch (error: unknown) {
    console.error('Error al guardar detalle:', error)
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const apiError = error as { response?: { data?: { message?: string } } }
      formError.value = apiError.response?.data?.message || 'Error al guardar el detalle'
    } else {
      formError.value = 'Error al guardar el detalle'
    }
  } finally {
    isLoading.value = false
  }
}

const cerrar = () => {
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="cerrar">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Agregar Detalle de Rollo</h2>
        <button class="close-btn" @click="cerrar">&times;</button>
      </div>

      <form @submit.prevent="guardarDetalle" class="form">
        <div v-if="formError" class="error-message">
          {{ formError }}
        </div>

        <div class="form-group">
          <label for="codigo">Código del Rollo (Opcional)</label>
          <input id="codigo" v-model="form.codigo" type="text" placeholder="Ej: ROLLO-001, A1, etc." />
        </div>

        <div class="form-group">
          <label for="cantidad">Cantidad ({{ medidaInd }}) *</label>
          <input id="cantidad" v-model.number="form.cantidad" type="number" step="0.01" placeholder="Ej: 50.5"
            required />
        </div>

        <div class="form-group">
          <label for="estado">Estado</label>
          <select id="estado" v-model="form.estado">
            <option value="DISPONIBLE">Disponible</option>
            <option value="RESERVADO">Reservado</option>
            <option value="DAÑADO">Dañado</option>
            <option value="EN_TRANSITO">En Tránsito</option>
          </select>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-cancel" @click="cerrar">Cancelar</button>
          <button type="submit" class="btn-save" :disabled="isLoading">
            {{ isLoading ? 'Guardando...' : 'Crear Detalle' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-height: 85vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.form {
  width: 100%;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4f8cff;
  box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.modal-footer {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  justify-content: flex-end;
}

.btn-cancel,
.btn-save {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-cancel {
  background: #f0f0f0;
  color: #333;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.btn-save {
  background: #4f8cff;
  color: white;
}

.btn-save:hover {
  background: #2563eb;
}

.btn-save:disabled {
  background: #ccc;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    padding: 1.5rem;
  }

  .modal-header h2 {
    font-size: 1.25rem;
  }
}
</style>
