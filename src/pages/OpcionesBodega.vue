<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from 'src/stores/auth';

const datos = ref<{ nombre?: string, rol?: string } | null>(null);
const authStore = useAuthStore();

onMounted(() => {
  datos.value = authStore.user;
})
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
        <h3>Ver categorías</h3>
        <p>Crea categorías de productos para consultas.</p>
        <router-link to="/categorias" class="btn">Entrar</router-link>
      </div>
      <div class="card">
        <span class="icon">➕</span>
        <h3>Dar de alta productos</h3>
        <p>Añadir productos nuevos al inventario actual.</p>
        <router-link to="/productos" class="btn">Entrar</router-link>
      </div>
      <div class="card" v-if="datos?.rol === 'visor'">
        <span class="icon">📦</span>
        <h3>Detalles de Inventario</h3>
        <p>Ver y editar metros disponibles de cada rollo.</p>
        <router-link to="/detalles-inventario" class="btn">Entrar</router-link>
      </div>
      <div class="card" v-if="datos?.rol === 'visor'">
        <span class="icon">👥</span>
        <h3>Administrar usuarios</h3>
        <p>Crear y gestionar usuarios del sistema.</p>
        <router-link to="/usuarios" class="btn">Entrar</router-link>
      </div>
      <div class="card">
        <span class="icon">📄</span>
        <h3>Ver órdenes de compra</h3>
        <p>Consulta de órdenes de compra.</p>
        <router-link to="/ordenes" class="btn">Entrar</router-link>
      </div>
      <div class="card" v-if="datos?.rol === 'visor'">
        <span class="icon">📊</span>
        <h3>Ver ventas</h3>
        <p>Visualiza todas las ventas de productos.</p>
        <router-link to="/ventas" class="btn">Entrar</router-link>
      </div>
      <div class="card">
        <span class="icon">🦺</span>
        <h3>Crear proveedores</h3>
        <p>Añade nuevos proveedores de materiales.</p>
        <router-link to="/proveedores" class="btn">Entrar</router-link>
      </div>
      <div class="card">
        <span class="icon">⏳</span>
        <h3>Ver historial</h3>
        <p>Ver historial de motivos de cambios de productos.</p>
        <router-link to="/historial" class="btn">Entrar</router-link>
      </div>
      <div class="card">
        <span class="icon">🪙</span>
        <h3>Calculadora de precios</h3>
        <p>Administrar cambios en los precios de productos.</p>
        <router-link to="/calculadora" class="btn">Entrar</router-link>
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
  background: #4f8cff;
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
  background: #2563eb;
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
