<script setup lang="ts">
import { ref, watch } from 'vue'
import api from 'src/api/axios'

interface Usuario {
  id?: number
  username: string
  email: string
  nombre: string
  password?: string
  rol?: string
}

interface UsuarioPayload {
  username: string
  email: string
  nombre: string
  rol: string
  passw?: string
}

interface Props {
  visible: boolean
  usuario?: Usuario | null
}

const props = withDefaults(defineProps<Props>(), {
  usuario: null
})

const emit = defineEmits<{
  close: []
  usuarioGuardado: [usuario: Usuario]
}>()

const form = ref<Usuario>({
  username: '',
  email: '',
  nombre: '',
  password: '',
  rol: 'vendedor'
})

const isLoading = ref(false)
const formError = ref<string | null>(null)
const isEditMode = ref(false)

// Watch para cuando cambie el usuario o la visibilidad del modal
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      if (props.usuario && props.usuario.id) {
        // Modo edición
        isEditMode.value = true
        form.value = {
          id: props.usuario.id,
          username: props.usuario.username || '',
          email: props.usuario.email || '',
          nombre: props.usuario.nombre || '',
          rol: props.usuario.rol || 'vendedor'
          // password NO se relleña en edición
        }
      } else {
        // Modo creación
        isEditMode.value = false
        form.value = {
          username: '',
          email: '',
          nombre: '',
          password: '',
          rol: 'vendedor'
        }
      }
      formError.value = null
    }
  }
)

const guardarUsuario = async () => {
  formError.value = null

  // Validaciones
  if (!form.value.username || !form.value.email || !form.value.nombre) {
    formError.value = 'Por favor completa todos los campos requeridos'
    return
  }

  if (!isEditMode.value && !form.value.password) {
    formError.value = 'La contraseña es requerida para crear un nuevo usuario'
    return
  }

  // Validar email/usuario (acepta nombres simples como "visor", "vendedor1", etc.)
  if (form.value.email.trim().length < 2) {
    formError.value = 'El usuario/email debe tener al menos 2 caracteres'
    return
  }
  // Verificar que no contenga espacios
  if (/\s/.test(form.value.email)) {
    formError.value = 'El usuario/email no puede contener espacios'
    return
  }

  isLoading.value = true

  try {
    const payload: UsuarioPayload = {
      username: form.value.username,
      email: form.value.email,
      nombre: form.value.nombre,
      rol: form.value.rol || 'vendedor'
    }

    // Agregar password (como 'passw' que es lo que espera el backend)
    if (!isEditMode.value && form.value.password) {
      payload.passw = form.value.password
    } else if (isEditMode.value && form.value.password) {
      payload.passw = form.value.password
    }

    let response

    if (isEditMode.value && form.value.id) {
      // Actualizar usuario
      response = await api.put(`usuarios/${form.value.id}`, payload)
    } else {
      // Crear nuevo usuario
      response = await api.post('usuarios', payload)
    }

    emit('usuarioGuardado', response.data)
    cerrar()
  } catch (error: unknown) {
    console.error('Error al guardar usuario:', error)
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const apiError = error as { response?: { data?: { message?: string } } }
      formError.value = apiError.response?.data?.message || 'Error al guardar el usuario'
    } else {
      formError.value = 'Error al guardar el usuario'
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
        <h2>{{ isEditMode ? 'Editar Usuario' : 'Crear Nuevo Usuario' }}</h2>
        <button class="close-btn" @click="cerrar">&times;</button>
      </div>

      <form @submit.prevent="guardarUsuario" class="form">
        <div v-if="formError" class="error-message">
          {{ formError }}
        </div>

        <div class="form-group">
          <label for="username">Usuario *</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="Nombre(s)"
            required
          />
        </div>

        <div class="form-group">
          <label for="email">Usuario/Email *</label>
          <input
            id="email"
            v-model="form.email"
            type="text"
            placeholder="Ej: visor, vendedor1, secretaria"
            required
          />
        </div>

        <div class="form-group">
          <label for="nombre">Nombre Completo *</label>
          <input
            id="nombre"
            v-model="form.nombre"
            type="text"
            placeholder="Ingresa nombre(s) y apellidos"
            required
          />
        </div>

        <div class="form-group">
          <label for="rol">Rol</label>
          <select id="rol" v-model="form.rol">
            <option value="vendedor">Vendedor</option>
            <option value="caja">Caja</option>
            <option value="secretaria">Secretaria</option>
            <option value="visor">Visor</option>
          </select>
        </div>

        <div class="form-group">
          <label for="password">{{ isEditMode ? 'Contraseña (dejar en blanco para no cambiar)' : 'Contraseña' }} {{ !isEditMode ? '*' : '' }}</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            :placeholder="isEditMode ? 'Dejar en blanco para no cambiar' : 'Ingresa una contraseña segura'"
            :required="!isEditMode"
          />
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-cancel" @click="cerrar">Cancelar</button>
          <button type="submit" class="btn-save" :disabled="isLoading">
            {{ isLoading ? 'Guardando...' : 'Guardar' }}
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

/* Responsividad para tablets */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.5rem;
  }

  .modal-content {
    width: 95%;
    padding: 1.5rem;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header h2 {
    font-size: 1.25rem;
  }

  .form-group {
    margin-bottom: 0.9rem;
  }

  .form-group label {
    font-size: 0.95rem;
  }

  .form-group input,
  .form-group select {
    padding: 0.7rem;
    font-size: 16px;
    border-radius: 4px;
  }

  .btn-cancel,
  .btn-save {
    padding: 0.7rem 1.2rem;
    font-size: 0.95rem;
    flex: 1;
  }

  .modal-footer {
    gap: 0.6rem;
    margin-top: 1.5rem;
  }
}

/* Responsividad para móviles */
@media (max-width: 480px) {
  .modal-overlay {
    padding: 1rem;
  }

  .modal-content {
    width: 100%;
    padding: 1rem;
    border-radius: 6px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    margin-bottom: 1rem;
  }

  .modal-header h2 {
    font-size: 1.1rem;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    font-size: 1.3rem;
  }

  .form-group {
    margin-bottom: 0.8rem;
  }

  .form-group label {
    font-size: 0.9rem;
    margin-bottom: 0.4rem;
  }

  .form-group input,
  .form-group select {
    padding: 0.6rem;
    font-size: 16px;
    border-radius: 3px;
  }

  .error-message {
    padding: 0.6rem;
    font-size: 0.85rem;
  }

  .modal-footer {
    gap: 0.4rem;
    margin-top: 1.5rem;
  }

  .btn-cancel,
  .btn-save {
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
    flex: 1;
  }
}
</style>
