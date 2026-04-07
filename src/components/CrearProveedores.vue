<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '../api/axios'

interface Proveedor {
  id?: number
  nombre: string
  contacto: string
  telefono?: string
  direccion?: string
}

const props = defineProps<{
  visible: boolean
  proveedor?: Proveedor | undefined
}>()

const emit = defineEmits(['close', 'proveedorCreado', 'proveedorActualizado'])

const nombre = ref('')
const contacto = ref('')
const telefono = ref('')
const direccion = ref('')
const error = ref<string | null>(null)
const isEditing = ref(false)
const currentId = ref<number | undefined>(undefined)

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.proveedor?.id) {
      // Modo edición
      isEditing.value = true
      currentId.value = props.proveedor.id
      nombre.value = props.proveedor.nombre
      contacto.value = props.proveedor.contacto
      telefono.value = props.proveedor.telefono || ''
      direccion.value = props.proveedor.direccion || ''
    } else {
      // Modo creación
      isEditing.value = false
      resetForm()
    }
  }
})

const resetForm = () => {
  nombre.value = ''
  contacto.value = ''
  telefono.value = ''
  direccion.value = ''
  error.value = null
  currentId.value = undefined
}

const cerrarModal = () => {
  resetForm()
  emit('close')
}

const guardarProveedor = async () => {
  try {
    const payload = {
      nombre: nombre.value,
      contacto: contacto.value,
      telefono: telefono.value,
      direccion: direccion.value
    }

    if (isEditing.value && currentId.value) {
      // Actualizar
      const response = await api.put(`proveedores/${currentId.value}`, payload)
      emit('proveedorActualizado', response.data)
    } else {
      // Crear
      const response = await api.post('proveedores', payload)
      emit('proveedorCreado', response.data)
    }
    cerrarModal()
  } catch (err) {
    error.value = isEditing.value ? 'Error al actualizar el proveedor' : 'Error al crear el proveedor'
    console.error(err)
  }
}
</script>

<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal">
      <h2>{{ isEditing ? 'Editar Proveedor' : 'Crear Proveedor' }}</h2>
      <form @submit.prevent="guardarProveedor">
        <div>
          <label>Nombre:</label>
          <input v-model="nombre" type="text" required />
        </div>
        <div>
          <label>Contacto:</label>
          <input v-model="contacto" type="text" required />
        </div>
        <div>
          <label>Teléfono:</label>
          <input v-model="telefono" type="number" required />
        </div>
        <div>
          <label>Dirección:</label>
          <input v-model="direccion" type="text" />
        </div>
        <button type="submit">{{ isEditing ? 'Actualizar' : 'Crear' }}</button>
        <button type="button" @click="cerrarModal">Cancelar</button>
      </form>
      <p v-if="error" style="color: red;">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
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
