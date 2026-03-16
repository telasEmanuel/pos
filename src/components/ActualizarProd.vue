<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '../api/axios'

const props = defineProps({
  show: Boolean,
  producto: Object
})

const emit = defineEmits(['close', 'updated'])

const form = ref({
  nombre: '',
  precio: 0,
  precio_tap: 0,
  precio_comp: 0,
  descripcion: ''
})

const loading = ref(false)
const error = ref('')

// Watch para llenar el formulario cuando se selecciona un producto
watch(() => props.producto, (newProducto) => {
  if (newProducto) {
    form.value = {
      nombre: newProducto.nombre || '',
      precio: newProducto.precio || 0,
      precio_tap: newProducto.precio_tap || 0,
      precio_comp: newProducto.precio_comp || 0,
      descripcion: newProducto.descripcion || ''
    }
  }
}, { immediate: true })

const cerrarModal = () => {
  emit('close')
  error.value = ''
}

const actualizarProducto = async () => {
  if (!props.producto?.id) {
    error.value = 'No se encontró el ID del producto'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await api.put(`productos/${props.producto.id}`, {
      nombre: form.value.nombre,
      precio: form.value.precio,
      precio_tap: form.value.precio_tap,
      precio_comp: form.value.precio_comp,
      descripcion: form.value.descripcion
    })

    emit('updated')
    cerrarModal()
  } catch (err) {
    console.error('Error al actualizar producto:', err)
    error.value = 'Error al actualizar el producto'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="cerrarModal">
    <div class="modal">
      <h2>Editar Producto</h2>

      <form @submit.prevent="actualizarProducto">
        <div v-if="producto" class="producto-info">
          <p><strong>ID:</strong> {{ producto.id }}</p>
        </div>

        <div class="form-group">
          <label for="nombre">Nombre:</label>
          <input type="text" id="nombre" v-model="form.nombre" required :disabled="loading"
            placeholder="Nombre del producto">
        </div>

        <div class="form-group">
          <label for="descripcion">Descripción:</label>
          <input type="text" id="descripcion" v-model="form.descripcion" :disabled="loading"
            placeholder="Descripción del producto">
        </div>

        <div class="form-group">
          <label for="precio">Precio público:</label>
          <input type="number" id="precio" v-model.number="form.precio" min="0" step="0.01" required :disabled="loading"
            placeholder="0.00">
        </div>

        <div class="form-group">
          <label for="precio">Precio tapicero:</label>
          <input type="number" id="precio" v-model.number="form.precio_tap" min="0" step="0.01" required
            :disabled="loading" placeholder="0.00">
        </div>

        <div class="form-group">
          <label for="precio_comp">Precio Compra:</label>
          <input type="number" id="precio_comp" v-model.number="form.precio_comp" min="0" step="0.01" required
            :disabled="loading" placeholder="0.00">
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
  color: #2563eb;
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
  color: #2563eb;
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
.form-group select {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.97rem;
  background: #f7fafc;
  transition: border 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #4f8cff;
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
  background: #4f8cff;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-2px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #f3f4f6;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
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
