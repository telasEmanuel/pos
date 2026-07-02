<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '../api/axios'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['close', 'cuentaCreada'])

const nombre = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

watch(() => props.visible, (newVal) => {
  if (newVal) resetForm()
})

const resetForm = () => {
  nombre.value = ''
  error.value = null
}

const cerrarModal = () => {
  emit('close')
}

const crearCuenta = async () => {
  if (!nombre.value.trim()) {
    error.value = 'El nombre es requerido'
    return
  }

  loading.value = true
  try {
    const response = await api.post('cuentas', {
      nombre: nombre.value,
    })
    emit('cuentaCreada', response.data)
    cerrarModal()
  } catch (err) {
    error.value = 'Error al crear la cuenta'
    console.error(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal">
      <h2>Crear Cuenta Bancaria</h2>
      <form @submit.prevent="crearCuenta">
        <div class="form-group">
          <label>Nombre de la cuenta:</label>
          <input v-model="nombre" type="text" required placeholder="Ej: Santander" />
        </div>

        <div v-if="error" class="error">{{ error }}</div>

        <div class="modal-buttons">
          <button type="submit" :disabled="loading">
            {{ loading ? 'Creando...' : 'Crear Cuenta' }}
          </button>
          <button type="button" @click="cerrarModal">Cancelar</button>
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

.error {
  background: #fee;
  color: #c33;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.modal-buttons {
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

button[type='submit'] {
  background: var(--gradient-brand-90);
  color: white;
}

button[type='submit']:hover:not(:disabled) {
  background: var(--color-brand-secondary);
}

button[type='submit']:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button[type='button'] {
  background: linear-gradient(180deg, #fef3c7 0%, #fde68a 100%);
  color: var(--color-brand-secondary);
}

button[type='button']:hover {
  background: linear-gradient(180deg, #fde68a 0%, #fcd34d 100%);
}
</style>
