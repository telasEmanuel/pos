<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import api from '../api/axios'

const props = defineProps({
  show: { type: Boolean, required: true },
  categoria: { type: Object as () => { id: number; nombre: string; descripcion?: string; seccion_id?: number } | null, required: false }
})

const emit = defineEmits(['close', 'updated'])

const form = ref({
  nombre: '',
  descripcion: '',
  seccion_id: 0
})

const loading = ref(false)
const error = ref('')
const secciones = ref<Array<{ id: number; nombre: string }>>([])

// Watch para llenar el formulario cuando se selecciona una categoría
watch(() => props.categoria, (newCategoria) => {
  if (newCategoria) {
    form.value = {
      nombre: newCategoria.nombre || '',
      descripcion: newCategoria.descripcion || '',
      seccion_id: newCategoria.seccion_id || 0
    }
  }
}, { immediate: true })

const cerrarModal = () => {
  emit('close')
  error.value = ''
}

const actualizarCategoria = async () => {
  if (!props.categoria?.id) {
    error.value = 'No se encontró el ID de la categoría'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await api.put(`categorias/${props.categoria.id}`, {
      nombre: form.value.nombre,
      descripcion: form.value.descripcion,
      seccion_id: form.value.seccion_id
    })

    emit('updated')
    cerrarModal()
  } catch (err) {
    console.error('Error al actualizar categoría:', err)
    error.value = 'Error al actualizar la categoría'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const res = await api.get('secciones')
    secciones.value = res.data || []
  } catch (err) {
    console.error('Error cargando secciones:', err)
  }
})
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="cerrarModal">
    <div class="modal">
      <h2>Editar Categoría</h2>

      <form @submit.prevent="actualizarCategoria">
        <div v-if="categoria" class="categoria-info">
          <p><strong>ID:</strong> {{ categoria.id }}</p>
        </div>

        <div class="form-group">
          <label for="nombre">Nombre:</label>
          <input type="text" id="nombre" v-model="form.nombre" required :disabled="loading"
            placeholder="Nombre de la categoría">
        </div>

        <div class="form-group">
          <label for="descripcion">Ficha técnica:</label>
          <textarea id="descripcion" v-model="form.descripcion" :disabled="loading"
            placeholder="Ficha técnica de la categoría" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label for="seccion">Sección:</label>
          <select id="seccion" v-model.number="form.seccion_id" :disabled="loading">
            <option :value="0" disabled>Selecciona una sección</option>
            <option v-for="seccion in secciones" :key="seccion.id" :value="seccion.id">
              {{ seccion.nombre }}
            </option>
          </select>
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

.categoria-info {
  background: #f4f7ff;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.categoria-info p {
  margin: 0;
  color: var(--color-brand-primary);
  font-weight: 500;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.3rem;
  color: #444;
  font-size: 0.95rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.97rem;
  background: #f7fafc;
  transition: border 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #fff;
}

.form-group input:disabled,
.form-group textarea:disabled,
.form-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group textarea {
  resize: vertical;
  min-height: 60px;
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
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 0.6rem 1.1rem;
  border: none;
  border-radius: 7px;
  font-weight: 600;
  font-size: 0.97rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--gradient-brand-90);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-brand-secondary);
  transform: translateY(-2px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #FFF9E6;
  color: var(--color-brand-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: #FFE8B6;
  transform: translateY(-2px);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .modal {
    width: 95vw;
    padding: 1rem 0.75rem;
  }

  .button-group {
    flex-direction: column;
  }
}
</style>
