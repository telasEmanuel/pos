<template>
  <component :is="layout">
    <!-- Banner de actualización PWA -->
    <q-banner v-if="hasUpdate" class="bg-info text-white">
      <template #avatar>
        <q-icon name="system_update" size="md" />
      </template>
      <div class="text-weight-bold">Nueva versión disponible</div>
      <div class="text-caption">Actualiza la app para obtener las últimas mejoras</div>
      <template #action>
        <q-btn flat dense label="Actualizar" color="white" @click.stop="reloadApp" class="q-ml-md" />
        <q-btn flat dense round icon="close" color="white" @click.stop="dismissUpdate" />
      </template>
    </q-banner>

    <div class="app-header">
    </div>
    <router-view v-slot="{ Component }">
      <transition appear mode="out-in" name="side">
        <div :key="$route.fullPath">
          <component :is="Component" />
        </div>
      </transition>
    </router-view>
  </component>
</template>

<script lang="ts">
import { LoginPage } from "./pages/index.js";
import { useAppUpdate } from "./composables/useAppUpdate";
import { onMounted } from 'vue';

export default {
  setup() {
    const { hasUpdate, checkForUpdates, reloadApp: originalReloadApp } = useAppUpdate()

    // Wrapper para manejar el clic de actualizar
    const handleReloadApp = async () => {
      console.log('📲 Usuario hizo clic en Actualizar');
      try {
        await originalReloadApp()
      } catch (error) {
        console.error('❌ Error en reloadApp:', error)
        // Forzar recarga aunque haya error
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    }

    // Wrapper para cerrar el banner
    const handleDismissUpdate = () => {
      console.log('❌ Usuario cerró el banner');
      hasUpdate.value = false
    }

    // Llamar a checkForUpdates cuando el componente se monta
    onMounted(async () => {
      console.log('🚀 App montada - ejecutando checkForUpdates()');
      await checkForUpdates();
    })

    return {
      hasUpdate,
      reloadApp: handleReloadApp,
      dismissUpdate: handleDismissUpdate
    }
  },
  computed: {
    LoginPage() {
      return LoginPage
    },
    layout() {
      return this.$route.meta.layout || 'div'
    }
  }
}
</script>

<style scoped>
.side-enter-active,
.side-leave-active {
  transition: all .5s ease;
}

.side-enter-from,
.side-leave-to {
  transform: translateY(100vh);
  opacity: 0;
}
</style>
