<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
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
const datos = ref<{ nombre?: string, rol?: string } | null>(null);
const authStore = useAuthStore();

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

const abrirCarritoConPassword = () => {
  showPasswordDialog.value = true;
  passwordInput.value = '';
  passwordError.value = '';
  currentPasswordContext.value = 'carrito';
}

const abrirCorteConPassword = () => {
  showPasswordDialog.value = true;
  passwordInput.value = '';
  passwordError.value = '';
  currentPasswordContext.value = 'corte';
}

/*const abrirReporteConPassword = () => {
  showPasswordDialog.value = true;
  passwordInput.value = '';
  passwordError.value = '';
  currentPasswordContext.value = 'reporte';

  //@click="abrirReporteConPassword"
}*/

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

// const cargarPedidos = async () => {
//   try {
//     await pedidosStore.obtenerPedidos()
//   } catch (error) {
//     console.error('Error cargando pedidos:', error)
//     $q.notify({
//       message: 'Error al cargar los pedidos',
//       color: 'negative',
//       icon: 'error',
//       position: 'top'
//     })
//   }
// }

onMounted(() => {
  // Solicitar permiso para notificaciones del sistema
  if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    void Notification.requestPermission();
  }

  datos.value = authStore.user;

  leftDrawerOpen.value = false;

  //void cargarPedidos()

  // Escuchar nuevos pedidos por socket
  socket.on('orden-recibida', (pedido: Pedido | PedidoBackend) => {
    console.log('Nuevo pedido recibido:', pedido)
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
    console.log('Pedido actualizado:', pedido)
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

onUnmounted(() => {
  socket.off('orden-recibida')
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
        <div v-if="datos?.rol === 'caja'">
          <q-item clickable @click="abrirCarritoConPassword">
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

          <q-item clickable to="/caja">
            <q-item-section avatar>
              <q-icon name="storefront" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Pedidos</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable @click="abrirCorteConPassword">
            <q-item-section avatar>
              <q-icon name="point_of_sale" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Corte de Caja</q-item-label>
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

          <q-item clickable to="/reporte">
            <q-item-section avatar>
              <q-icon name="table_rows" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Reporte de Existencias</q-item-label>
            </q-item-section>
          </q-item>

          <InventoryManagerModal :show="showInventoryManager" @close="showInventoryManager = false" />

          <q-item clickable @click="cerrarSesion">
            <q-item-section avatar>
              <q-icon name="logout" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Cerrar sesión</q-item-label>
            </q-item-section>
          </q-item>
        </div>

        <div v-if="datos?.rol === 'vendedor'">
          <q-item clickable to="/select">
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

          <q-item clickable to="/caja">
            <q-item-section avatar>
              <q-icon name="storefront" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Pedidos</q-item-label>
            </q-item-section>
          </q-item>

          <!--<q-item clickable @click="showInventoryManager = true">
            <q-item-section avatar>
              <q-icon name="inventory" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Gestión de Inventario</q-item-label>
            </q-item-section>
          </q-item>-->

          <q-item clickable @click="cerrarSesion">
            <q-item-section avatar>
              <q-icon name="logout" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Cerrar sesión</q-item-label>
            </q-item-section>
          </q-item>
        </div>

        <div v-if="datos?.rol === 'visor'">
          <q-item clickable to="/select">
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

          <q-item clickable to="/corte">
            <q-item-section avatar>
              <q-icon name="point_of_sale" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Corte de Caja</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable to="/reporte">
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

          <q-item clickable @click="cerrarSesion">
            <q-item-section avatar>
              <q-icon name="logout" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Cerrar sesión</q-item-label>
            </q-item-section>
          </q-item>
        </div>

        <div v-if="datos?.rol === 'secretaria'">
          <q-item clickable to="/select">
            <q-item-section avatar>
              <q-icon name="home" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Inicio</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable to="/reporte">
            <q-item-section avatar>
              <q-icon name="table_rows" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Reporte de Existencias</q-item-label>
            </q-item-section>
          </q-item>

          <!--<q-item clickable @click="showInventoryManager = true">
            <q-item-section avatar>
              <q-icon name="inventory" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Gestión de Inventario</q-item-label>
            </q-item-section>
          </q-item>-->

          <q-item clickable @click="cerrarSesion">
            <q-item-section avatar>
              <q-icon name="logout" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Cerrar sesión</q-item-label>
            </q-item-section>
          </q-item>
        </div>
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
