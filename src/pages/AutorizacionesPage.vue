<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import api from 'src/api/axios'
import { useQuasar } from 'quasar'

interface Usuario {
  id: number
  email: string
  username?: string
  nombre?: string
  rol: string
  corte_caja?: boolean | number
  reporte_existencia?: boolean | number
  categorias?: boolean | number
  productos?: boolean | number
  detalles_inventario?: boolean | number
  ordenes?: boolean | number
  proveedores?: boolean | number
  historial_movimientos?: boolean | number
  calculadora?: boolean | number
  secciones?: boolean | number
  reporte_ventas?: boolean | number
  usuarios?: boolean | number
}

const $q = useQuasar()
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref<Usuario | null>(null)
const loading = ref(false)
const guardando = ref(false)
const busqueda = ref('')

// Permisos disponibles
const permisos = [
  { key: 'categorias', label: 'Categorías', icon: '💎' },
  { key: 'productos', label: 'Productos', icon: '➕' },
  { key: 'detalles_inventario', label: 'Detalles de Inventario', icon: '📦' },
  { key: 'usuarios', label: 'Administrar Usuarios', icon: '👥' },
  { key: 'ordenes', label: 'Órdenes de Compra', icon: '📄' },
  { key: 'reporte_ventas', label: 'Reporte de Ventas', icon: '📊' },
  { key: 'proveedores', label: 'Proveedores', icon: '🦺' },
  { key: 'historial_movimientos', label: 'Historial de Movimientos', icon: '⏳' },
  { key: 'calculadora', label: 'Calculadora de Precios', icon: '🧮' },
  { key: 'secciones', label: 'Secciones', icon: '🏷️' },
  { key: 'corte_caja', label: 'Corte de Caja', icon: '💰' },
  { key: 'reporte_existencia', label: 'Reporte de Existencias', icon: '📈' }
]

// Convertir 0/1 a booleano
const convertirABooleano = (valor: unknown): boolean => {
  if (valor === null || valor === undefined) return false
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'number') return valor !== 0
  if (typeof valor === 'string') return valor === '1' || valor.toLowerCase() === 'true'
  return !!valor
}

const usuariosFiltrados = computed(() => {
  if (!busqueda.value) return usuarios.value
  const term = busqueda.value.toLowerCase()
  return usuarios.value.filter(u =>
    u.nombre?.toLowerCase().includes(term) ||
    u.email?.toLowerCase().includes(term) ||
    u.username?.toLowerCase().includes(term)
  )
})

const seleccionarUsuario = (usuario: Usuario) => {
  usuarioSeleccionado.value = {
    ...usuario
  }
}

const togglePermiso = (key: string) => {
  if (!usuarioSeleccionado.value) return
  const usuario = usuarioSeleccionado.value as Record<string, unknown>
  usuario[key] = !convertirABooleano(usuario[key])
}

const obtenerPermiso = (usuario: Usuario | null, key: string): boolean => {
  if (!usuario) return false
  return convertirABooleano(usuario[key as keyof Usuario])
}

const cargarUsuarios = async () => {
  loading.value = true
  try {
    const response = await api.get('usuarios')
    usuarios.value = response.data
    console.log('✅ Usuarios cargados:', usuarios.value.length)
  } catch (err) {
    console.error('Error cargando usuarios:', err)
    $q.notify({
      message: 'Error al cargar usuarios',
      color: 'negative',
      icon: 'error',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

const guardarPermisos = async () => {
  if (!usuarioSeleccionado.value) return

  guardando.value = true
  try {
    const datosActualizados = {
      corte_caja: convertirABooleano(usuarioSeleccionado.value.corte_caja),
      reporte_existencia: convertirABooleano(usuarioSeleccionado.value.reporte_existencia),
      categorias: convertirABooleano(usuarioSeleccionado.value.categorias),
      productos: convertirABooleano(usuarioSeleccionado.value.productos),
      detalles_inventario: convertirABooleano(usuarioSeleccionado.value.detalles_inventario),
      ordenes: convertirABooleano(usuarioSeleccionado.value.ordenes),
      proveedores: convertirABooleano(usuarioSeleccionado.value.proveedores),
      historial_movimientos: convertirABooleano(usuarioSeleccionado.value.historial_movimientos),
      calculadora: convertirABooleano(usuarioSeleccionado.value.calculadora),
      secciones: convertirABooleano(usuarioSeleccionado.value.secciones),
      reporte_ventas: convertirABooleano(usuarioSeleccionado.value.reporte_ventas),
      usuarios: convertirABooleano(usuarioSeleccionado.value.usuarios)
    }

    console.log('📤 Enviando permisos actualizados:', datosActualizados)

    await api.put(`usuarios/${usuarioSeleccionado.value.id}`, datosActualizados)

    // Actualizar el usuario en la lista
    const idx = usuarios.value.findIndex(u => u.id === usuarioSeleccionado.value!.id)
    if (idx >= 0) {
      usuarios.value[idx] = { ...usuarioSeleccionado.value, ...datosActualizados }
    }

    $q.notify({
      message: `Permisos de ${usuarioSeleccionado.value.nombre || usuarioSeleccionado.value.email} actualizados correctamente`,
      color: 'positive',
      icon: 'check_circle',
      position: 'top'
    })
  } catch (err) {
    console.error('Error guardando permisos:', err)
    $q.notify({
      message: 'Error al guardar permisos',
      color: 'negative',
      icon: 'error',
      position: 'top'
    })
  } finally {
    guardando.value = false
  }
}

const limpiar = () => {
  usuarioSeleccionado.value = null
  busqueda.value = ''
}

onMounted(() => {
  void cargarUsuarios()
})
</script>

<template>
  <div class="autorizaciones-container">
    <div class="header">
      <h1>Gestión de Permisos</h1>
      <p class="subtitle">Asigna y revoca permisos a los usuarios del sistema</p>
    </div>

    <div class="content-grid">
      <!-- Panel de Usuarios -->
      <section class="usuarios-panel">
        <div class="panel-header">
          <h2>Usuarios</h2>
          <button @click="cargarUsuarios" :disabled="loading" class="btn-refresh">
            🔄
          </button>
        </div>

        <div class="search-box">
          <input v-model="busqueda" type="text" placeholder="Buscar por nombre, email o usuario..."
            class="search-input" />
        </div>

        <div v-if="loading" class="loading">Cargando usuarios...</div>

        <div v-else-if="usuariosFiltrados.length === 0" class="empty-state">
          Sin usuarios
        </div>

        <div v-else class="usuarios-list">
          <div v-for="usuario in usuariosFiltrados" :key="usuario.id" class="usuario-item"
            :class="{ active: usuarioSeleccionado?.id === usuario.id }" @click="seleccionarUsuario(usuario)">
            <div class="usuario-avatar">{{ usuario.nombre?.charAt(0) || '?' }}</div>
            <div class="usuario-info">
              <div class="usuario-nombre">{{ usuario.nombre || usuario.username || 'Sin nombre' }}</div>
              <div class="usuario-email">{{ usuario.email }}</div>
              <div class="usuario-rol">{{ usuario.rol }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Panel de Permisos -->
      <section class="permisos-panel">
        <div v-if="!usuarioSeleccionado" class="empty-state-vertical">
          <div class="empty-icon">👤</div>
          <p>Selecciona un usuario para gestionar sus permisos</p>
        </div>

        <div v-else class="permisos-editor">
          <div class="editor-header">
            <div>
              <h2>{{ usuarioSeleccionado.nombre || usuarioSeleccionado.username || 'Usuario' }}</h2>
              <p class="email">{{ usuarioSeleccionado.email }}</p>
              <p class="rol">Rol: <strong>{{ usuarioSeleccionado.rol }}</strong></p>
            </div>
            <button @click="limpiar" class="btn-cerrar">✕</button>
          </div>

          <div class="permisos-grid">
            <div v-for="permiso in permisos" :key="permiso.key" class="permiso-item">
              <label class="permiso-label">
                <input type="checkbox" :checked="obtenerPermiso(usuarioSeleccionado, permiso.key)"
                  @change="togglePermiso(permiso.key)" class="permiso-checkbox" />
                <span class="permiso-icon">{{ permiso.icon }}</span>
                <span class="permiso-text">{{ permiso.label }}</span>
              </label>
            </div>
          </div>

          <div class="permisos-actions">
            <button @click="guardarPermisos" :disabled="guardando" class="btn-guardar">
              {{ guardando ? 'Guardando...' : '✓ Guardar Permisos' }}
            </button>
            <button @click="limpiar" class="btn-cancelar">Cancelar</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.autorizaciones-container {
  padding: 2rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  font-size: 2.5rem;
  color: #1a202c;
  margin: 0 0 0.5rem;
  font-weight: 800;
}

.subtitle {
  font-size: 1.1rem;
  color: #718096;
  margin: 0;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

/* Panel de Usuarios */
.usuarios-panel {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: fit-content;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.btn-refresh {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid white;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(20deg);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-box {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.loading {
  padding: 2rem;
  text-align: center;
  color: #718096;
  font-size: 1.1rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #a0aec0;
}

.usuarios-list {
  overflow-y: auto;
  max-height: 60vh;
}

.usuario-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #edf2f7;
  cursor: pointer;
  transition: all 0.2s;
}

.usuario-item:hover {
  background: #f7fafc;
}

.usuario-item.active {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-left: 4px solid #667eea;
  padding-left: calc(1rem - 4px);
}

.usuario-avatar {
  width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 1rem;
  flex-shrink: 0;
}

.usuario-info {
  flex: 1;
  min-width: 0;
}

.usuario-nombre {
  font-weight: 600;
  color: #1a202c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usuario-email {
  font-size: 0.85rem;
  color: #718096;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usuario-rol {
  font-size: 0.75rem;
  color: #a0aec0;
  margin-top: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Panel de Permisos */
.permisos-panel {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 400px;
}

.empty-state-vertical {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #cbd5e0;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state-vertical p {
  font-size: 1.1rem;
  margin: 0;
}

.permisos-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.editor-header h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.email {
  margin: 0.25rem 0;
  font-size: 0.95rem;
  opacity: 0.9;
}

.rol {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
}

.btn-cerrar {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-cerrar:hover {
  background: rgba(255, 255, 255, 0.3);
}

.permisos-grid {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .permisos-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}

.permiso-item {
  display: flex;
  align-items: center;
}

.permiso-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 1rem;
  background: #f7fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.2s;
  width: 100%;
}

.permiso-label:hover {
  border-color: #667eea;
  background: #edf2f7;
}

.permiso-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  margin-right: 0.75rem;
  cursor: pointer;
  accent-color: #667eea;
}

.permiso-icon {
  font-size: 1.5rem;
  margin-right: 0.5rem;
}

.permiso-text {
  font-size: 0.95rem;
  color: #2d3748;
  font-weight: 500;
}

.permiso-label input:checked+.permiso-icon+.permiso-text {
  color: #667eea;
}

.permisos-actions {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

.btn-guardar,
.btn-cancelar {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-guardar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-guardar:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
}

.btn-guardar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancelar {
  background: #e2e8f0;
  color: #2d3748;
}

.btn-cancelar:hover {
  background: #cbd5e0;
}
</style>
