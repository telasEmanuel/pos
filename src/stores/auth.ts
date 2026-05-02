import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface UserData {
  id?: number;
  usuario_id?: number;
  email?: string;
  username?: string;
  nombre?: string;
  rol?: string;
  [key: string]: unknown;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(sessionStorage.getItem('token') || null);
  const user = ref<UserData | null>(JSON.parse(sessionStorage.getItem('user') || 'null'));

  function setToken(newToken: string | null) {
    token.value = newToken;
    if (newToken) {
      sessionStorage.setItem('token', newToken);
    } else {
      sessionStorage.removeItem('token');
    }
  }

  function setUser(userData: UserData | null) {
    user.value = userData;
    if (userData) {
      sessionStorage.setItem('user', JSON.stringify(userData));
    } else {
      sessionStorage.removeItem('user');
    }
  }

  function convertirABooleano(valor: unknown): boolean {
    if (valor === null || valor === undefined) return false;
    if (typeof valor === 'boolean') return valor;
    if (typeof valor === 'number') return valor !== 0;
    if (typeof valor === 'string') return valor === '1' || valor.toLowerCase() === 'true';
    return !!valor;
  }

  function hasPerm(perm: string) {
    if (!perm) return true;
    // Bypass for admin role
    if (user.value?.rol === 'admin') return true;

    // Map route permission names to user object property names
    const permissionMap: Record<string, string> = {
      reporte_ventas: 'reporte_ventas',
      detalles_inventario: 'detalles_inventario',
      categorias: 'categorias',
      productos: 'productos',
      ordenes: 'ordenes',
      usuarios: 'usuarios',
      proveedores: 'proveedores',
      historial_movimientos: 'historial_movimientos',
      calculadora: 'calculadora',
      secciones: 'secciones',
      tickets: 'tickets',
      corte: 'corte',
      reporte_existencia: 'reporte_existencia',
      envios: 'envios'
    };

    // Get the property name from map, or use permission name directly
    const propName = permissionMap[perm] || perm;

    // Check if the permission property exists in user object
    const permValue = user.value?.[propName];
    return convertirABooleano(permValue);
  }

  function login(newToken: string, userData: UserData | null = null) {
    setToken(newToken);
    setUser(userData);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  function isAuthenticated() {
    return !!token.value;
  }

  return {
    token,
    user,
    setToken,
    setUser,
    hasPerm,
    login,
    logout,
    isAuthenticated,
  };
});
