<script setup lang="ts">
import { ref, watch } from 'vue'
import api from 'src/api/axios'

interface Inventario {
  id: number
  producto_id?: number
  producto?: { nombre: string }
  rollos?: number
  cantidad?: number
  cantidad_piezas?: number
  bodega_id?: number
  medida_gru?: string
  medida_ind?: string
  [key: string]: unknown
}

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  existencia: {
    type: Object as () => Inventario | null,
    default: null
  }
})

const emit = defineEmits<{
  close: []
  updated: []
}>()

const form = ref({
  rollos: 0,
  cantidad: 0,
  cantidad_piezas: 0,
  bodega_id: 0,
  medida_gru: '',
  medida_ind: ''
})

const loading = ref(false)
const error = ref('')

// Llena el formulario cuando se selecciona una existencia
watch(
  () => props.existencia,
  (newExistencia) => {
    if (newExistencia) {
      form.value.rollos = newExistencia.rollos || 0
      form.value.cantidad = newExistencia.cantidad || 0
      form.value.cantidad_piezas = newExistencia.cantidad_piezas || 0
      // No cargar bodega_id para que muestre "Selecciona una bodega" inicialmente
      // form.value.bodega_id = newExistencia.bodega_id || 0
      form.value.medida_gru = newExistencia.medida_gru || ''
      form.value.medida_ind = newExistencia.medida_ind || ''
    }
  },
  { immediate: true }
)

const cerrarModal = () => {
  emit('close')
  error.value = ''
}

const actualizarInventario = async () => {
  if (!props.existencia?.id) {
    error.value = 'No se encontró el ID de la existencia'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await api.put(`inventarios/${props.existencia.id}`, {
      rollos: form.value.rollos,
      cantidad: form.value.cantidad,
      cantidad_piezas: form.value.cantidad_piezas,
      bodega_id: form.value.bodega_id,
      medida_gru: form.value.medida_gru,
      medida_ind: form.value.medida_ind
    })

    emit('updated')
    cerrarModal()
  } catch (err) {
    console.error('Error al actualizar:', err)
    error.value = 'Error al actualizar el inventario'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="cerrarModal">
    <div class="modal">
      <h2>Editar Inventario</h2>

      <form @submit.prevent="actualizarInventario">
        <div v-if="existencia" class="producto-info">
          <p><strong>Producto:</strong> {{ existencia.producto?.nombre || 'Sin nombre' }}</p>
        </div>

        <!-- Fila 1: Control 1 y Tipo 1 -->
        <div class="form-group-row">
          <div class="form-group">
            <label for="rollos">Control 1:</label>
            <input type="number" id="rollos" v-model.number="form.rollos" min="0" required :disabled="loading" />
          </div>

          <div class="form-group">
            <label for="medida_gru">Tipo 1:</label>
            <select id="medida_gru" v-model="form.medida_gru" :disabled="loading">
              <option value="Rollos">Rollos</option>
              <option value="Cajas">Cajas</option>
              <option value="Latas">Latas</option>
              <option value="Piezas">Piezas</option>
              <option value="Conos">Conos</option>
              <option value="Kilos">Kilos</option>
              <option value="Bolsas">Bolsas</option>
            </select>
          </div>
        </div>

        <!-- Fila 2: Control 2 y Tipo 2 -->
        <div class="form-group-row">
          <div class="form-group">
            <label for="cantidad">Control 2:</label>
            <input type="number" id="cantidad" v-model.number="form.cantidad" min="0" step="0.01" required
              :disabled="loading" />
          </div>

          <div class="form-group">
            <label for="medida_ind">Tipo 2:</label>
            <select id="medida_ind" v-model="form.medida_ind" :disabled="loading">
              <option value="Metros">Metros</option>
              <option value="Piezas">Piezas</option>
              <option value="Litros">Litros</option>
              <option value="Kilos">Kilos</option>
              <option value="Bolsas">Bolsas</option>
              <option value="Planchas">Planchas</option>
            </select>
          </div>
        </div>

        <!-- Cantidad Piezas
        <div class="form-group">
          <label for="cantidad_piezas">Cantidad Piezas:</label>
          <input
            type="number"
            id="cantidad_piezas"
            v-model.number="form.cantidad_piezas"
            min="0"
            step="0.01"
            required
            :disabled="loading"
          />
        </div>-->

        <!-- Bodega -->
        <div class="form-group">
          <label for="bodega">Bodega: (Para cambiar un producto de bodega)</label>
          <select id="bodega" v-model.number="form.bodega_id" :disabled="loading">
            <option :value="0" disabled>Selecciona una bodega</option>
            <option :value="1">Tienda</option>
            <option :value="2">Bodega</option>
          </select>
        </div>

        <!-- Mensaje de Error -->
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <!-- Botones -->
        <div class="button-group">
          <button type="submit" :disabled="loading" class="btn-primary">
            {{ loading ? 'Actualizando...' : 'Actualizar' }}
          </button>
          <button type="button" @click="cerrarModal" :disabled="loading" class="btn-secondary">
            Cancelar
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
  background: rgba(40, 48, 63, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  padding: 1.5rem 1.2rem 1.2rem 1.2rem;
  border-radius: 14px;
  width: 420px;
  max-width: 98vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(60, 60, 90, 0.18);
  animation: modalIn 0.25s;
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

.modal h2 {
  margin-bottom: 1rem;
  color: var(--color-brand-primary);
  font-weight: 600;
  text-align: center;
  font-size: 1.15rem;
}

.producto-info {
  background: #f4f7ff;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.producto-info p {
  margin: 0;
  color: var(--color-brand-primary);
  font-weight: 500;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.form-group-row .form-group {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.3rem;
  color: #444;
  font-size: 0.95rem;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.97rem;
  background: #f7fafc;
  transition: border 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #fff;
}

.form-group input:disabled,
.form-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fee2e2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.button-group {
  display: flex;
  gap: 0.8rem;
  margin-top: 1.5rem;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 0.6rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--gradient-brand-90);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-brand-secondary);
}

.btn-secondary {
  background: #FFF9E6;
  color: var(--color-brand-secondary);
  border: 1px solid var(--color-brand-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
