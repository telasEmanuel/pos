<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from 'src/stores/auth';
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router';

const datos = ref<{ nombre?: string, rol?: string, categorias?: boolean, productos?: boolean, detalles_inventario?: boolean, ordenes?: boolean, proveedores?: boolean, historial_movimientos?: boolean, calculadora?: boolean, secciones?: boolean, reporte_ventas?: boolean, usuarios?: boolean, tickets?: boolean } | null>(null);
const authStore = useAuthStore();
const $q = useQuasar()
const router = useRouter();

// Helper para convertir 0/1 o true/false a booleano
const convertirABooleano = (valor: unknown): boolean => {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor !== 0;
  if (typeof valor === 'string') return valor === '1' || valor.toLowerCase() === 'true';
  return !!valor;
}

const checarPermiso = (seccion: string) => {
  switch (seccion) {
    case 'categorias':
      if (convertirABooleano(datos.value?.categorias)) {
        void router.push('/categorias');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'productos':
      if (convertirABooleano(datos.value?.productos)) {
        void router.push('/productos');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'detalles_inventario':
      if (convertirABooleano(datos.value?.detalles_inventario)) {
        void router.push('/detalles-inventario');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'usuarios':
      if (convertirABooleano(datos.value?.usuarios)) {
        void router.push('/usuarios');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'ordenes':
      if (convertirABooleano(datos.value?.ordenes)) {
        void router.push('/ordenes');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'ventas':
      if (convertirABooleano(datos.value?.reporte_ventas)) {
        void router.push('/ventas');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'proveedores':
      if (convertirABooleano(datos.value?.proveedores)) {
        void router.push('/proveedores');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'historial_movimientos':
      if (convertirABooleano(datos.value?.historial_movimientos)) {
        void router.push('/historial');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'calculadora':
      if (convertirABooleano(datos.value?.calculadora)) {
        void router.push('/calculadora');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'secciones':
      if (convertirABooleano(datos.value?.secciones)) {
        void router.push('/secciones');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break;
    case 'tickets':
      if (convertirABooleano(datos.value?.tickets)) {
        void router.push('/tickets');
      } else {
        $q.dialog({
          title: 'Acceso denegado',
          message: 'No tienes permiso para acceder a esta sección.',
          color: 'warning',
          ok: {
            text: 'Aceptar',
            color: 'yellow'
          }
        });
      }
      break
  }
}

onMounted(() => {
  // Cargar usuario inicial
  datos.value = authStore.user;

  console.log('%c📍 OpcionesBodega - onMounted', 'background: #222; color: #bada55; font-size: 14px; font-weight: bold;');
  console.log('authStore.user =', authStore.user);
  console.log('datos.value =', datos.value);
  console.log('sessionStorage.user =', JSON.parse(sessionStorage.getItem('user') || 'null'));

  if (datos.value) {
    console.log('✅ Usuario disponible. Permisos:', {
      categorias: convertirABooleano(datos.value?.categorias),
      productos: convertirABooleano(datos.value?.productos),
      ordenes: convertirABooleano(datos.value?.ordenes),
      usuarios: convertirABooleano(datos.value?.usuarios)
    });
  } else {
    console.warn('⚠️ No hay usuario en onMounted');
  }
})

// Watcher para detectar cambios en authStore.user
watch(() => authStore.user, (nuevoUsuario) => {
  console.log('%c👀 OpcionesBodega - watcher triggered', 'background: #ff6b6b; color: white; font-size: 12px');
  console.log('nuevoUsuario =', nuevoUsuario);

  if (nuevoUsuario) {
    datos.value = nuevoUsuario;
    console.log('✅ Usuario actualizado en OpcionesBodega (watcher):', datos.value);
  } else {
    console.warn('⚠️ Usuario cerró sesión, redirigiendo...');
    void router.push('/');
  }
}, { immediate: true })
</script>

<template>
  <div class="home-page">
    <!-- <header>
      <img src="https://img.icons8.com/color/96/box.png" alt="Inventario" class="logo" />
      <h1>Inventario Telas Emanuel</h1>
      <p class="subtitle">Para gestionar los inventarios.</p>
    </header> -->
    <section class="actions">
      <div class="card">
        <span class="icon">💎</span>
        <h3>Categorías</h3>
        <p>Crea categorías de productos.</p>
        <button @click="checarPermiso('categorias')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">➕</span>
        <h3>Alta de productos</h3>
        <p>Añadir productos nuevos al inventario actual.</p>
        <button @click="checarPermiso('productos')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">📦</span>
        <h3>Corregir inventarios</h3>
        <p>Actualizar cantidades de productos en inventarios.</p>
        <button @click="checarPermiso('detalles_inventario')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">👥</span>
        <h3>Configuración usuarios</h3>
        <p>Crear y gestionar usuarios del sistema.</p>
        <button @click="checarPermiso('usuarios')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">📄</span>
        <h3>Órdenes de compra</h3>
        <p>Creación y admnistración de órdenes de compra.</p>
        <button @click="checarPermiso('ordenes')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">📊</span>
        <h3>Reporte de ventas</h3>
        <p>Visualiza todas las ventas de productos.</p>
        <button @click="checarPermiso('ventas')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">🦺</span>
        <h3>Proveedores</h3>
        <p>Añade nuevos proveedores.</p>
        <button @click="checarPermiso('proveedores')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">⏳</span>
        <h3>Historial de movimientos</h3>
        <p>Ver historial de transferencias de productos.</p>
        <button @click="checarPermiso('historial_movimientos')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">🧮</span>
        <h3>Calculadora de precios</h3>
        <p>Calcular precios de productos.</p>
        <button @click="checarPermiso('calculadora')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">🗂️</span>
        <h3>Secciones</h3>
        <p>Crear secciones para organizar las categorías.</p>
        <button @click="checarPermiso('secciones')" class="btn">Entrar</button>
      </div>
      <div class="card">
        <span class="icon">🎫</span>
        <h3>Consulta de tickets</h3>
        <p>Tickets generados por ventas.</p>
        <button @click="checarPermiso('tickets')" class="btn">Entrar</button>
      </div>
    </section>
    <footer>
      <small>&copy; 2026 Telas Emanuel · Telas Emanuel App</small>
    </footer>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: 'Segoe UI', Arial, sans-serif;
}

header {
  text-align: center;
  margin-top: 48px;
}

.logo {
  width: 72px;
  margin-bottom: 12px;
}

.subtitle {
  color: #555;
  margin-bottom: 32px;
}

.actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  margin: 40px auto;
  padding: 0 20px;
  max-width: 1400px;
  width: 100%;
  justify-items: center;
}

.card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
  padding: 28px 20px;
  width: 100%;
  max-width: 240px;
  text-align: center;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
}

.icon {
  font-size: 3rem;
  margin-bottom: 12px;
  display: block;
}

.card h3 {
  font-size: 1.1rem;
  margin: 12px 0 8px 0;
  color: #333;
  font-weight: 600;
}

.card p {
  font-size: 0.85rem;
  color: #666;
  margin: 0 0 16px 0;
  line-height: 1.4;
}

.btn {
  margin-top: 12px;
  background: var(--gradient-brand-90);
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  display: inline-block;
  border: none;
  cursor: pointer;
}

.btn:hover {
  background: var(--color-brand-secondary);
  transform: scale(1.05);
}

footer {
  text-align: center;
  color: #888;
  margin-bottom: 24px;
  margin-top: 32px;
  font-size: 0.9rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .actions {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin: 30px auto;
    padding: 0 12px;
  }

  .card {
    padding: 24px 16px;
    max-width: 220px;
  }

  .icon {
    font-size: 2.5rem;
  }

  .card h3 {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .actions {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin: 20px auto;
  }

  .card {
    padding: 20px 12px;
    max-width: 180px;
  }

  .icon {
    font-size: 2rem;
  }

  .card h3 {
    font-size: 0.95rem;
  }

  .card p {
    font-size: 0.8rem;
  }
}
</style>
