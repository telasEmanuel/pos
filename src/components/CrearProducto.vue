<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import api from '../api/axios'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['close', 'productoCreado'])

const nombre = ref('')
const descripcion = ref('')
const precio = ref(0.00)
const precio_tap = ref(0.00)
const precio_comp = ref(0.00)
const categoria_id = ref()
const mensaje = ref('')
const error = ref<string | null>(null)
const categorias = ref<Array<{ id: number; nombre: string; descripcion?: string }>>([])

watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetForm()
  }
})

const resetForm = () => {
  nombre.value = ''
  descripcion.value = ''
  precio.value = 0
  precio_tap.value = 0
  precio_comp.value = 0
  categoria_id.value = 0
  mensaje.value = ''
  error.value = null
}

const cerrarModal = () => {
  emit('close')
}

const crearProducto = async () => {
  try {
    const response = await api.post('productos', {
      nombre: nombre.value,
      descripcion: descripcion.value,
      precio: parseFloat(precio.value as unknown as string),
      precio_tap: parseFloat(precio_tap.value as unknown as string),
      precio_comp: parseFloat(precio_comp.value as unknown as string),
      categoria_id: parseInt(categoria_id.value),
    })
    emit('productoCreado', response.data)
    cerrarModal()
  } catch (err) {
    error.value = 'Error al crear el producto'
    console.error(err)
  }
}

onMounted(async (): Promise<void> => {
  try {
    const response = await api.get('categorias')
    categorias.value = response.data
  } catch (err) {
    error.value = 'Error al obtener las categorías'
    console.error(err)
  }
});
</script>

<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal">
      <h2>Crear Producto</h2>
      <form @submit.prevent="crearProducto">
        <div>
          <label>Nombre:</label>
          <input v-model="nombre" required />
        </div>
        <div>
          <label>Descripción: (opcional)</label>
          <input v-model="descripcion" />
        </div>
        <div>
          <label>Precio Público:</label>
          <input type="number" step="0.01" v-model="precio" required />
        </div>
        <div>
          <label>Precio Tapicero:</label>
          <input type="number" step="0.01" v-model="precio_tap" required />
        </div>
        <div>
          <label>Precio Compra:</label>
          <input type="number" step="0.01" v-model="precio_comp" required />
        </div>
        <div>
          <label>Categoría:</label>
          <select v-model.number="categoria_id" required>
            <option disabled value="">Seleccione la categoría</option>
            <option v-for="p in categorias" :key="p.id" :value="p.id">{{ p.nombre }}</option>
          </select>
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
  font-size: 1.5rem;
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
  color: var(--color-brand-primary);
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

.modal input,
select {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 1rem;
  background: #f7fafc;
  transition: border 0.2s;
}

.modal input:focus,
select:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #fff;
}

.modal button[type="submit"] {
  background: var(--gradient-brand-90);
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
  background: var(--color-brand-secondary);
}

.modal button[type="button"] {
  background: #FFF9E6;
  color: var(--color-brand-secondary);
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
