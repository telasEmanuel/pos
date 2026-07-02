<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '../api/axios'

interface Cuenta {
  id: number
  nombre: string
}

const props = defineProps({
  visible: { type: Boolean, required: true },
  cuenta: { type: Object as () => Cuenta | null, required: false }
})

const emit = defineEmits(['close', 'cuentaActualizada'])

const nombre = ref('')
const loading = ref(false)
const error = ref('')

watch(() => props.cuenta, (newCuenta) => {
  if (newCuenta) {
    nombre.value = newCuenta.nombre || ''
  }
}, { immediate: true })

const cerrarModal = () => {
  emit('close')
  error.value = ''
}

const actualizarCuenta = async () => {
  if (!props.cuenta?.id) {
    error.value = 'No se encontró el ID de la cuenta'
    return
  }

  if (!nombre.value.trim()) {
    error.value = 'El nombre es requerido'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await api.put(`cuentas/${props.cuenta.id}`, {
      nombre: nombre.value,
    })

    emit('cuentaActualizada')
    cerrarModal()
  } catch (err) {
    console.error('Error al actualizar cuenta:', err)
    error.value = 'Error al actualizar la cuenta'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="cerrarModal">
    <div class="modal">
      <h2>Actualizar Cuenta Bancaria</h2>

      <form @submit.prevent="actualizarCuenta">
        <div v-if="cuenta" class="cuenta-info">
          <p><strong>ID:</strong> {{ cuenta.id }}</p>
        </div>

        <div class="form-group">
          <label for="nombre">Nombre de la cuenta:</label>
          <input type="text" id="nombre" v-model="nombre" required :disabled="loading"
            placeholder="Ej: Santander">
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

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
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

h2 {
  color: var(--color-brand-primary);
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-weight: 600;
}

.cuenta-info {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.cuenta-info p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #333;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px rgba(255, 213, 79, 0.1);
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.button-group {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

button {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--gradient-brand-90);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-brand-secondary);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: linear-gradient(180deg, #fef3c7 0%, #fde68a 100%);
  color: var(--color-brand-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: linear-gradient(180deg, #fde68a 0%, #fcd34d 100%);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
