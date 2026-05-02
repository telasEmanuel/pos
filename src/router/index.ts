import { defineRouter } from '#q-app/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import type { RouteLocationNormalized } from 'vue-router';
import routes from './routes';
import { useAuthStore } from 'src/stores/auth';
import { Dialog } from 'quasar';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // Guard global: autenticación y autorización por permiso (meta.permiso)
  Router.beforeEach((to: RouteLocationNormalized, from: RouteLocationNormalized, next) => {
    const authStore = useAuthStore();
    const isLoginPage = to.path === '/';
    const hasToken = !!authStore.token;

    const permisoRaw = (to.meta as { permiso?: unknown }).permiso;
    const requiredPerm = typeof permisoRaw === 'string' ? permisoRaw : undefined;

    // Si la ruta no requiere permiso, sólo validar token si la ruta no es pública
    if (!requiredPerm) {
      if (!hasToken && !isLoginPage) {
        return next('/');
      }
      return next();
    }

    // Ruta requiere permiso
    if (!hasToken) {
      return next('/');
    }

    // Verificar permiso (usa propiedades del objeto user)
    if (authStore.hasPerm(requiredPerm)) {
      return next();
    }

    // Si no tiene permiso, informar y redirigir a inicio
    Dialog.create({
      title: 'Acceso denegado',
      message: 'No tienes permiso para acceder a esta sección.',
      color: 'warning',
      ok: { text: 'Aceptar', color: 'yellow' },
    });
    return next('/select');
  });

  return Router;
});
