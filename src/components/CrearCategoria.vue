<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '../api/axios'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['close', 'categoriaCreada'])

const nombre = ref('')
const descripcion = ref('')
const error = ref<string | null>(null)

watch(() => props.visible, (newVal) => {
  if (newVal) resetForm()
})

const resetForm = () => {
  nombre.value = ''
  descripcion.value = ''
  error.value = null
}

const cerrarModal = () => {
  emit('close')
}

const crearCategoria = async () => {
  try {
    const response = await api.post('categorias', {
      nombre: nombre.value,
      descripcion: descripcion.value
    })
    emit('categoriaCreada', response.data)
    cerrarModal()
  } catch (err) {
    error.value = 'Error al crear la categoría'
    console.error(err)
  }
}
</script>

<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal">
      <h2>Crear Categoría</h2>
      <form @submit.prevent="crearCategoria">
        <div>
          <label>Nombre:</label>
          <input v-model="nombre" required />
        </div>
        <div>
          <label>Ficha técnica: (opcional)</label>
          <input v-model="descripcion" />
        </div>
        <button type="submit">Crear</button>
        <button type="button" @click="cerrarModal">Cancelar</button>
      </form>
      <p v-if="error" style="color: red;">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
h2 {
  color: #333;
  font-size: 1.8rem;
  margin: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(40, 48, 63, 0.35);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  padding: 2.5rem 2rem 2rem 2rem;
  border-radius: 18px;
  width: 380px;
  max-width: 95vw;
  box-shadow: 0 8px 32px rgba(60, 60, 90, 0.18);
  display: flex;
  flex-direction: column;
  align-items: stretch;
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
  margin-bottom: 1.2rem;
  color: #2563eb;
  font-weight: 600;
  text-align: center;
}

.modal form>div {
  margin-bottom: 1rem;
}

.modal label {
  display: block;
  margin-bottom: 0.3rem;
  color: #444;
  font-size: 0.97rem;
  font-weight: 500;
}

.modal input {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 1rem;
  background: #f7fafc;
  transition: border 0.2s;
}

.modal input:focus {
  border-color: #4f8cff;
  outline: none;
  background: #fff;
}

.modal button[type="submit"] {
  background: #4f8cff;
  color: #fff;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  margin-right: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.modal button[type="submit"]:hover {
  background: #2563eb;
}

.modal button[type="button"] {
  background: #f3f4f6;
  color: #333;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.modal button[type="button"]:hover {
  background: #e5e7eb;
}

.modal p[style] {
  margin-top: 1rem;
  text-align: center;
  font-weight: 500;
}
</style>
