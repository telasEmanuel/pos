import { ref, onMounted, onBeforeUnmount } from 'vue';
import axios from 'axios';

interface VersionData {
  version: string;
  timestamp: number;
  notes?: string;
}

export function useAppUpdate() {
  const hasUpdate = ref(false);
  const updateAvailable = ref(false);

  /**
   * Limpia agresivamente todos los service workers y caches obsoletos
   * Necesario para cuando la app fue instalada con versión anterior
   */
  const cleanupServiceWorkers = async () => {
    try {
      // Limpia TODOS los service workers registrados
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();

        for (const registration of registrations) {
          // Intenta actualizar primero
          try {
            await registration.update();
          } catch {
            console.error('⚠️ No se pudo actualizar SW');
          }

          // Luego desregistra versiones obsoletas
          const isActive = registration === (await navigator.serviceWorker.ready);
          if (!isActive) {
            await registration.unregister();
          }
        }
      }

      // Limpia TODOS los caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(async (name) => {
            await caches.delete(name);
          }),
        );
      }
    } catch (error) {
      console.error('⚠️ Error limpiando service workers:', error);
    }
  };

  const checkForUpdates = async () => {
    try {
      // Agrega timestamp al URL para evitar cache del navegador
      const response = await axios.get<VersionData>(`/version.json?t=${Date.now()}`, {
        timeout: 5000,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const serverVersion = response.data.version;
      const localVersion = localStorage.getItem('appVersion');

      // Primera visita: inicializar con la versión del servidor
      if (!localVersion) {
        localStorage.setItem('appVersion', serverVersion);
        // Limpia SWs obsoletos de instalación anterior
        await cleanupServiceWorkers();
        return;
      }

      // Si hay una nueva versión diferente
      if (serverVersion !== localVersion) {
        hasUpdate.value = true;
        updateAvailable.value = true;
      } else {
        hasUpdate.value = false;
      }
    } catch (error) {
      console.error('⚠️ Error checking for updates:', error);
    }
  };

  const reloadApp = async () => {
    // Oculta el banner INMEDIATAMENTE
    hasUpdate.value = false;
    updateAvailable.value = false;

    try {
      // Obtiene la versión más reciente
      const versionResponse = await fetch(`/version.json?t=${Date.now()}`);
      const data = (await versionResponse.json()) as VersionData;
      localStorage.setItem('appVersion', data.version);
      localStorage.setItem('lastUpdateTime', new Date().toISOString());
    } catch (err) {
      console.error('Error actualizando versión:', err);
    }

    // Limpia agresivamente todo
    await cleanupServiceWorkers();

    // Limpia sessionStorage pero mantiene localStorage
    sessionStorage.clear();

    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Inicia el chequeo de actualizaciones
  if (typeof window !== 'undefined') {
    onMounted(async () => {
      // Primer chequeo inmediato
      await checkForUpdates();

      // Chequeos más frecuentes: cada 1 minuto
      const checkInterval = 1 * 60 * 1000;
      let intervalId: ReturnType<typeof setInterval> | null = setInterval(() => {
        void checkForUpdates().catch((err) => console.error('Error en chequeo periódico:', err));
      }, checkInterval);

      // Escucha cuando el usuario vuelve a la app (visibilidad)
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          void checkForUpdates().catch((err) => console.error('Error en visibilitychange:', err));
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Limpieza al desmontar
      onBeforeUnmount(() => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      });
    });
  }

  return {
    hasUpdate,
    updateAvailable,
    checkForUpdates,
    reloadApp,
  };
}
