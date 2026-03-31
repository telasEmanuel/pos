import { ref } from 'vue';
import axios from 'axios';

interface VersionData {
  version: string;
  timestamp: number;
  notes?: string;
}

export function useAppUpdate() {
  const hasUpdate = ref(false);
  const updateAvailable = ref(false);

  const checkForUpdates = async () => {
    try {
      console.log('🔍 Verificando actualizaciones...');
      // Agrega timestamp al URL para evitar cache del navegador
      const response = await axios.get<VersionData>(`/version.json?t=${Date.now()}`, {
        timeout: 5000,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const serverVersion = response.data.version;
      const localVersion = localStorage.getItem('appVersion');

      console.log(`📱 PWA Version Check: Local=${localVersion}, Server=${serverVersion}`);

      // Primera visita: inicializar con la versión del servidor
      if (!localVersion) {
        console.log('📦 Primera vez: inicializando versión');
        localStorage.setItem('appVersion', serverVersion);
        return;
      }

      // Si hay una nueva versión diferente
      if (serverVersion !== localVersion) {
        console.log('🆕 Nueva versión disponible');
        hasUpdate.value = true;
        updateAvailable.value = true;
      } else {
        console.log('✅ Usando la última versión');
        hasUpdate.value = false;
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
      console.log('✅ Versión actualizada en localStorage');
    } catch (err) {
      console.error('Error actualizando versión:', err);
    }

    // Limpia caches de la PWA
    if ('caches' in window) {
      try {
        console.log('🗑️ Limpiando caches...');
        const names = await caches.keys();
        await Promise.all(
          names.map(async (name) => {
            await caches.delete(name);
            console.log(`✅ Cache "${name}" eliminado`);
          }),
        );
      } catch (err) {
        console.error('Error limpiando caches:', err);
      }
    }

    // Limpia sessionStorage pero mantiene localStorage
    sessionStorage.clear();

    // Recarga después de un delay para asegurar que se vea que el banner desapareció
    console.log('♻️ Recargando página en 1 segundo...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Inicia el chequeo de actualizaciones en el next tick
  if (typeof window !== 'undefined') {
    console.log('⏱️ Inicializando verificador de actualizaciones PWA');
    // Primer chequeo inmediato
    checkForUpdates().catch((err) => console.error('Error en chequeo inicial:', err));

    // Chequeos periódicos cada 5 minutos
    const checkInterval = 5 * 60 * 1000;
    const intervalId = setInterval(() => {
      checkForUpdates().catch((err) => console.error('Error en chequeo periódico:', err));
    }, checkInterval);

    // Limpia el intervalo si es necesario (aunque normalmente corre indefinidamente)
    if (typeof globalThis !== 'undefined') {
      (globalThis as unknown as Record<string, unknown>).__updateCheckIntervalId = intervalId;
    }
  }

  return {
    hasUpdate,
    updateAvailable,
    checkForUpdates,
    reloadApp,
  };
}
