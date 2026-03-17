import { ref, onMounted } from 'vue';
import axios from 'axios';

interface VersionData {
  version: string;
  timestamp: number;
  notes?: string;
}

export function useAppUpdate() {
  const hasUpdate = ref(false);
  const updateAvailable = ref(false);

  onMounted(() => {
    initializeUpdateCheck();
  });

  const initializeUpdateCheck = () => {
    // Chequea actualizaciones cada 5 minutos
    const checkInterval = 5 * 60 * 1000;
    void checkForUpdates();
    setInterval(() => {
      void checkForUpdates();
    }, checkInterval);
  };

  const checkForUpdates = async () => {
    try {
      // Agrrega timestamp al URL para evitar cache del navegador
      const response = await axios.get<VersionData>(`/version.json?t=${Date.now()}`, {
        timeout: 5000,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const serverVersion = response.data.version;
      const localVersion = localStorage.getItem('appVersion') || '0';

      console.log(`📱 PWA Version Check: Local=${localVersion}, Server=${serverVersion}`);

      if (serverVersion !== localVersion) {
        console.log('🆕 Nueva versión disponible');
        hasUpdate.value = true;
        updateAvailable.value = true;
        // NO actualizamos localStorage aquí, solo cuando el usuario hace clic
      }
    } catch (error) {
      console.error('⚠️ Error checking for updates:', error);
    }
  };

  const reloadApp = async () => {
    console.log('🔄 Recargando app con nueva versión...');

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

    // Limpia caches de la PWA
    if ('caches' in window) {
      try {
        const names = await caches.keys();
        await Promise.all(
          names.map(async (name) => {
            await caches.delete(name);
            console.log(`✅ Cache "${name}" limpiado`);
          }),
        );
      } catch (err) {
        console.error('Error limpiando caches:', err);
      }
    }

    // Limpia sessionStorage pero mantiene localStorage
    sessionStorage.clear();

    // Añade parámetro timestamp para forzar recarga sin cache
    setTimeout(() => {
      window.location.href = `/?nocache=${Date.now()}`;
    }, 500);
  };

  return {
    hasUpdate,
    updateAvailable,
    checkForUpdates,
    reloadApp,
  };
}
