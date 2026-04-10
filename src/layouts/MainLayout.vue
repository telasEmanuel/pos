<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth';
import { socket } from 'src/boot/socket'
import { useQuasar } from 'quasar'
import { usePedidosStore, type Pedido, type PedidoBackend } from 'src/stores/pedidos-store'
import { storeToRefs } from 'pinia'
import InventoryManagerModal from 'src/components/InventoryManagerModal.vue';

const showInventoryManager = ref(false);
const showPasswordDialog = ref(false);
const passwordInput = ref('');
const passwordError = ref('');
const currentPasswordContext = ref<'carrito' | 'corte' | 'reporte'>('carrito');

const $q = useQuasar()
const pedidosStore = usePedidosStore()
const { pedidos } = storeToRefs(pedidosStore)
const router = useRouter();
const leftDrawerOpen = ref(false);
const datos = ref<{ nombre?: string, rol?: string, corte_caja?: boolean, reporte_existencia?: boolean, carrito?: boolean } | null>(null);
const authStore = useAuthStore();

// Helper para convertir 0/1 o true/false a booleano
const convertirABooleano = (valor: unknown): boolean => {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor !== 0;
  if (typeof valor === 'string') return valor === '1' || valor.toLowerCase() === 'true';
  return !!valor;
}

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

const validarPassword = () => {
  if (currentPasswordContext.value === 'carrito' && passwordInput.value === import.meta.env.VITE_CARRITO) {
    showPasswordDialog.value = false;
    passwordInput.value = '';
    passwordError.value = '';
    void router.push('/carrito');
  } else if (currentPasswordContext.value === 'corte' && passwordInput.value === import.meta.env.VITE_CORTE) {
    showPasswordDialog.value = false;
    passwordInput.value = '';
    passwordError.value = '';
    void router.push('/corte');
  } else if (currentPasswordContext.value === 'reporte' && passwordInput.value === import.meta.env.VITE_CARRITO) {
    showPasswordDialog.value = false;
    passwordInput.value = '';
    passwordError.value = '';
    void router.push('/reporte');
  } else {
    passwordError.value = 'Contraseña incorrecta';
    passwordInput.value = '';
  }
}

const cerrarPasswordDialog = () => {
  showPasswordDialog.value = false;
  passwordInput.value = '';
  passwordError.value = '';
}

const cerrarSesion = async () => {
  const yes = confirm('¿Estás seguro de que deseas cerrar sesión?');
  if (yes) {
    authStore.logout();
    await router.push('/');
  }
}

const checarPermiso = (seccion: string) => {
  switch (seccion) {
    case 'corte':
      if (convertirABooleano(datos.value?.corte_caja)) {
        void router.push('/corte');
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
    case 'reporte':
      if (convertirABooleano(datos.value?.reporte_existencia)) {
        void router.push('/reporte');
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
  }
}

const validarPermiso = () => {
  if (datos.value?.rol === 'caja') {
    if (convertirABooleano(datos.value?.carrito)) {
      console.log('entra en el if')
      console.log('valor booleano: '+datos.value?.carrito)
      void router.push('/carrito');
    } else {
      console.log('valor boleano: '+datos.value?.carrito)
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
  } else {
    void router.push('/select');
  }
}

onMounted(() => {
  // Solicitar permiso para notificaciones del sistema
  if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    void Notification.requestPermission();
  }

  datos.value = authStore.user;
  console.log('✅ Usuario cargado en MainLayout (onMounted):', datos.value);

  if (!datos.value) {
    console.warn('⚠️ No hay usuario en onMounted. Esperando...');
  }

  leftDrawerOpen.value = false;

  //void cargarPedidos()

  // Escuchar nuevos pedidos por socket
  socket.on('nuevo-pedido', (pedido: Pedido | PedidoBackend) => {
    console.log('🟢 [MainLayout] ⭐ EVENTO SOCKET RECIBIDO - nuevo-pedido:', { id: pedido.id, comprador: pedido.comprador });

    // Guardar el usuario_username en localStorage para evitar pérdida de datos
    const pedidoConUsername = pedido as unknown as Record<string, string | null>;
    if (pedidoConUsername.usuario_username && typeof pedidoConUsername.usuario_username === 'string') {
      const key = `pedido_${pedido.id}_usuario_username`;
      localStorage.setItem(key, pedidoConUsername.usuario_username);
      console.log(`  ✅ GUARDADO EN LOCALSTORAGE: "${key}" = "${pedidoConUsername.usuario_username}"`);
    } else {
      console.log(`  ⚠️ NO HAY usuario_username en el evento socket. usuario_username =`, pedidoConUsername.usuario_username);
    }

    pedidosStore.agregarPedidoLocal(pedido)
    // Obtener el nombre del comprador independientemente del formato
    const comprador = pedido.comprador
    $q.notify({
      message: `¡Nuevo pedido de ${comprador}!`,
      color: 'positive',
      icon: 'shopping_cart',
      position: 'top-right',
      timeout: 5000,
      actions: [
        { label: 'Ver', color: 'white', handler: () => { void router.push('/caja') } }
      ]
    })

    // Notificación del sistema
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('¡Nuevo pedido!', {
        body: `Pedido recibido de ${comprador}`,
        icon: '/icons/128x128.png',
      });
      notification.onclick = () => {
        window.focus();
        void router.push('/caja');
      };
    }
  })

  // Escuchar actualizaciones de pedidos
  socket.on('pedido-actualizado', (pedido: Pedido | PedidoBackend) => {
    const index = pedidos.value.findIndex(p => p.id === pedido.id)
    if (index !== -1) {
      // Si tiene DetallePedido, necesita transformación
      if ('DetallePedido' in pedido) {
        pedidosStore.agregarPedidoLocal(pedido)
        // Remover el pedido antiguo
        pedidos.value.splice(index, 1)
      } else {
        pedidos.value[index] = pedido as Pedido
      }
    }
  })
})

// Watcher para detectar cambios en authStore.user
watch(() => authStore.user, (nuevoUsuario) => {
  if (nuevoUsuario) {
    datos.value = nuevoUsuario;
    console.log('✅ Usuario actualizado en MainLayout (watcher):', datos.value);
  } else {
    console.warn('⚠️ Usuario cerró sesión, redirigiendo...');
    void router.push('/');
  }
}, { immediate: true })

onUnmounted(() => {
  socket.off('nuevo-pedido')
  socket.off('pedido-actualizado')
})
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          Telas Emanuel
        </q-toolbar-title>

        <div v-if="datos">{{ datos.nombre?.toUpperCase() }}</div>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" :show-if-above="false" bordered>
      <q-list>
        <q-item-label header>
          Menú de opciones
        </q-item-label>

        <q-item clickable @click="validarPermiso()">
          <q-item-section avatar>
            <q-icon name="home" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Inicio</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable to="/tienda">
          <q-item-section avatar>
            <q-icon name="store" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Categorías Tienda</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable to="/bodega">
          <q-item-section avatar>
            <q-icon name="warehouse" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Categorías Bodega</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable @click="checarPermiso('corte')">
          <q-item-section avatar>
            <q-icon name="point_of_sale" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Corte de Caja</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable @click="checarPermiso('reporte')">
          <q-item-section avatar>
            <q-icon name="table_rows" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Reporte de Existencias</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable @click="showInventoryManager = true">
          <q-item-section avatar>
            <q-icon name="inventory" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Gestión de Inventario</q-item-label>
          </q-item-section>
        </q-item>

        <InventoryManagerModal :show="showInventoryManager" @close="showInventoryManager = false" />

        <q-item clickable to="/moresettings">
          <q-item-section avatar>
            <q-icon name="add_box" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Más configuraciones</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable @click="cerrarSesion">
          <q-item-section avatar>
            <q-icon name="logout" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Cerrar sesión</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container class="main-bg">
      <router-view />
    </q-page-container>

    <q-dialog v-model="showPasswordDialog" persistent>
      <q-card style="min-width: 300px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Ingresar contraseña</div>
          <q-space />
          <q-btn icon="close" flat round dense @click="cerrarPasswordDialog" />
        </q-card-section>

        <q-card-section>
          <q-input v-model="passwordInput" type="password" label="Contraseña" outlined @keyup.enter="validarPassword"
            autofocus />
          <div v-if="passwordError" class="text-negative text-caption q-mt-md">
            {{ passwordError }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="primary" @click="cerrarPasswordDialog" />
          <q-btn unelevated label="Aceptar" color="primary" @click="validarPassword" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<style scoped>
/* Fondo principal: amarillo -> blanco -> café */
.main-bg {
  background: linear-gradient(135deg, #FFEB99 0%, #FFFFFF 50%, #8B5E3C 100%);
  min-height: 100vh;
}

/* Encabezado con tonos cálidos */
.q-header {
  background: linear-gradient(90deg, #FFD54F 0%, #8B5E3C 100%) !important;
  color: #fff;
}

/* Drawer más claro para contraste */
.q-drawer {
  background: linear-gradient(180deg, #FFF8E1 0%, #F5E6D6 100%) !important;
}

.q-drawer .q-item-label,
.q-drawer .q-item-section {
  color: #5a3f2b !important;
}

.q-toolbar-title {
  color: #4a2e1a !important;
  font-weight: 800;
}
</style>
