<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from 'src/api/axios'
import CrearActualizarUsuario from 'src/components/CrearActualizarUsuario.vue'

interface Usuario {
  id: number
  username: string
  email: string
  nombre: string
  rol?: string
}

const usuarios = ref<Usuario[]>([])
const error = ref<string | null>(null)
const loading = ref(true)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const usuarioSeleccionado = ref<Usuario | null>(null)

const abrirCreateModal = (): void => {
  usuarioSeleccionado.value = null
  showCreateModal.value = true
}

const cerrarCreateModal = (): void => {
  showCreateModal.value = false
  usuarioSeleccionado.value = null
}

const cerrarEditModal = (): void => {
  showEditModal.value = false
  usuarioSeleccionado.value = null
}

const abrirEditModal = (usuario: Usuario): void => {
  usuarioSeleccionado.value = usuario
  showEditModal.value = true
}

const onUsuarioGuardado = (): void => {
  alert('Usuario guardado exitosamente')
  void cargarUsuarios()
  cerrarCreateModal()
  cerrarEditModal()
}

const eliminarUsuario = async (id: number): Promise<void> => {
  if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
    return
  }

  try {
    await api.delete(`usuarios/${id}`)
    alert('Usuario eliminado correctamente')
    await cargarUsuarios() // Recargar datos
  } catch (err) {
    console.error('Error al eliminar usuario:', err)
    alert('Error al eliminar el usuario')
  }
}

const cargarUsuarios = async (): Promise<void> => {
  try {
    const response = await api.get('usuarios')
    usuarios.value = Array.isArray(response.data)
      ? response.data
      : (response.data.usuarios ?? [])

    const normalizedUsuarios: Usuario[] = usuarios.value.map((u: Record<string, unknown>) => ({
      id: (u.id as number) || (u.Id as number),
      username: (u.username as string) || (u.Username as string),
      email: (u.email as string) || (u.Email as string),
      nombre: (u.nombre as string) || (u.Nombre as string),
      rol: ((u.rol as string) || (u.Rol as string)) ?? 'vendedor'
    }))
    usuarios.value = normalizedUsuarios

    error.value = null
    loading.value = false
  } catch (err) {
    console.error('Error al cargar usuarios:', err)
    error.value = 'Error al obtener los usuarios'
    loading.value = false
  }
}

onMounted((): void => {
  void cargarUsuarios()
})
</script>

<template>
  <div class="container">
    <!-- Header minimalista con título y botón -->
    <div class="header">
      <h1>Gestión de Usuarios</h1>
      <button @click="abrirCreateModal()" class="btn-crear">+ Crear Usuario</button>
    </div>

    <div v-if="loading" class="loading">
      <p>Cargando usuarios...</p>
    </div>

    <div v-else>
      <!-- Mostrar errores -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Tabla de usuarios -->
      <table v-if="usuarios.length" class="tabla">
        <thead>
          <tr>
            <th>ID</th>
            <th>Usuario</th>
            <th>Email</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="usuario in usuarios" :key="usuario.id">
            <td>{{ usuario.id }}</td>
            <td>{{ usuario.username }}</td>
            <td>{{ usuario.email }}</td>
            <td>{{ usuario.nombre }}</td>
            <td><span class="rol-badge" :class="`rol-${usuario.rol?.toLowerCase()}`">{{ usuario.rol }}</span></td>
            <td class="acciones">
              <button @click="abrirEditModal(usuario)" class="btn-editar">Editar</button>
              <button @click="eliminarUsuario(usuario.id)" class="btn-eliminar">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="no-data">
        <p>No hay usuarios disponibles en este momento.</p>
      </div>
    </div>

    <!-- Modal para crear usuario -->
    <CrearActualizarUsuario :visible="showCreateModal" @close="cerrarCreateModal"
      @usuarioGuardado="onUsuarioGuardado" />

    <!-- Modal para editar usuario -->
    <CrearActualizarUsuario :visible="showEditModal" :usuario="usuarioSeleccionado" @close="cerrarEditModal"
      @usuarioGuardado="onUsuarioGuardado" />
  </div>
</template>

<style scoped>
.container {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

h1 {
  color: #333;
  font-size: 1.8rem;
  margin: 0;
}

.btn-crear {
  background: #4f8cff;
  color: white;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-crear:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 140, 255, 0.3);
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem 0;
  border-left: 4px solid #c33;
}



.tabla {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  background: white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  overflow: hidden;
}

.tabla th,
.tabla td {
  padding: 1rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.tabla th {
  background-color: #f5f5f5;
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.tabla tbody tr {
  transition: background-color 0.2s ease;
}

.tabla tbody tr:hover {
  background-color: #f9f9f9;
}

.tabla tbody tr:last-child td {
  border-bottom: none;
}

.rol-badge {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  text-transform: capitalize;
}

.rol-admin {
  background: #fee;
  color: #c33;
}

.rol-vendedor {
  background: #e3f2fd;
  color: #1976d2;
}

.rol-caja {
  background: #f0f4ff;
  color: #4f8cff;
}

.rol-secretaria {
  background: #f3e5f5;
  color: #7b1fa2;
}

.rol-visor {
  background: #e8f5e9;
  color: #388e3c;
}

.acciones {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-editar,
.btn-eliminar {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-editar {
  background: #10b981;
  color: white;
}

.btn-editar:hover {
  background: #059669;
  transform: translateY(-2px);
}

.btn-eliminar {
  background: #ef4444;
  color: white;
}

.btn-eliminar:hover {
  background: #dc2626;
  transform: translateY(-2px);
}

.no-data {
  text-align: center;
  padding: 3rem;
  color: #666;
  background: #f9f9f9;
  border-radius: 8px;
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  h1 {
    font-size: 1.5rem;
  }

  .btn-crear {
    width: 100%;
  }

  .tabla {
    font-size: 0.9rem;
  }

  .tabla th,
  .tabla td {
    padding: 0.75rem 0.5rem;
  }

  .acciones {
    flex-direction: column;
    gap: 0.3rem;
  }

  .btn-editar,
  .btn-eliminar {
    width: 100%;
    padding: 0.5rem;
    font-size: 0.8rem;
  }
}
</style>
