<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '../api/axios'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['close', 'seccionCreada'])

const nombre = ref('')
const descripcion = ref('')
const orden = ref(0)
const error = ref<string | null>(null)
const loading = ref(false)

watch(() => props.visible, (newVal) => {
  if (newVal) resetForm()
})

const resetForm = () => {
  nombre.value = ''
  descripcion.value = ''
  orden.value = 0
  error.value = null
}

const cerrarModal = () => {
  emit('close')
}

const crearSeccion = async () => {
  if (!nombre.value.trim()) {
    error.value = 'El nombre es requerido'
    return
  }

  loading.value = true
  try {
    const response = await api.post('secciones', {
      nombre: nombre.value,
      descripcion: descripcion.value,
      orden: orden.value
    })
    emit('seccionCreada', response.data)
    cerrarModal()
  } catch (err) {
    error.value = 'Error al crear la sección'
    console.error(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal">
      <h2>Crear Sección</h2>
      <form @submit.prevent="crearSeccion">
        <div class="form-group">
          <label>Nombre:</label>
          <input v-model="nombre" type="text" required placeholder="Ej: Residencial" />
        </div>

        <div class="form-group">
          <label>Descripción:</label>
          <textarea v-model="descripcion" placeholder="Descripción de la sección (opcional)"></textarea>
        </div>

        <!--<div class="form-group">
          <label>Orden:</label>
          <input v-model.number="orden" type="number" placeholder="Orden de presentación" />
        </div>-->

        <div v-if="error" class="error">{{ error }}</div>

        <div class="modal-buttons">
          <button type="submit" :disabled="loading">
            {{ loading ? 'Creando...' : 'Crear Sección' }}
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

input,
textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px rgba(255, 213, 79, 0.1);
}

textarea {
  resize: vertical;
  min-height: 100px;
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
