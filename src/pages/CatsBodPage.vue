<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from 'src/api/axios';
import { useAuthStore } from 'src/stores/auth';

interface Categoria {
  id: number
  nombre: string
  descripcion: string
}

interface Producto {
  id: number
  bodega_id: number
  producto?: {
    id?: number
    nombre: string
    categoria_id: number
    precio_comp?: number
  }
  categoria_id?: number
  categoriaId?: number
  cantidad: number
  precio_comp: number
  [key: string]: unknown
}

const existencias = ref<unknown[]>([]);
const categorias = ref<Categoria[]>([]);
const productos = ref<Producto[]>([]);
const loading = ref(false);
const authStore = useAuthStore();
const datos = ref<{ email?: string } | null>(null);

const mostrarExistencias = async () => {
  try {
    const res = await api.get('inventarios');
    existencias.value = res.data;
    const items = Array.isArray(res.data) ? res.data : (res.data.items ?? []);
    productos.value = items
      .filter((p: Producto) => p.bodega_id === 2)
      .map((p: Producto) => {
        const prodObj = p.producto || { precio_comp: 0 };
        return {
          ...p,
          precio_comp: Number(p.precio_comp ?? prodObj.precio_comp ?? 0),
        };
      });
    loading.value = true;
  } catch (err) {
    console.error('Error al obtener las existencias:', err);
  }
};

const cargarCategorias = async () => {
  try {
    const response = await api.get('categorias');
    categorias.value = response.data;
    console.log(categorias.value)
  } catch (err) {
    console.error('Error al cargar categorías', err);
  }
};

const valorTotalAlmacenado = (): number => {
  return productos.value.reduce((total, prod) => {
    const precioComp = Number(prod.precio_comp || 0);
    const cantidad = Number(prod.cantidad || 0);
    return total + (precioComp * cantidad);
  }, 0);
};

const formatCurrency = (val: number) => {
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

onMounted(() => {
  datos.value = authStore.user as { email: string };
  void cargarCategorias();
  void mostrarExistencias();
});
</script>

<template>
  <main class="home-page">
    <nav class="breadcrumb">
      <!--<router-link to="/select" class="breadcrumb-item">Inicio</router-link>
      <span class="breadcrumb-separator">/</span>-->
      <span class="breadcrumb-current">Categorías Bodega</span>
    </nav>

    <!-- Valor Total Almacenado -->
    <div class="valor-total-container" v-if="datos?.email === 'visor'">
      <div class="valor-total-card">
        <div class="valor-content">
          <p class="valor-label">Valor Total Almacenado</p>
          <p class="valor-amount">{{ formatCurrency(valorTotalAlmacenado()) }}</p>
        </div>
      </div>
    </div>

    <h1 class="main-title">Existencias</h1>
    <section class="actions">
      <router-link v-for="cat in categorias" :key="cat.id"
        :to="{ name: 'ConfiguracionPorCategoria', params: { categoryId: cat.id }, query: { technicalCard: cat.descripcion } }"
        class="card">
        <p class="sections">{{ cat.nombre }}</p>
      </router-link>
    </section>
  </main>
</template>

<style scoped>
.main-title {
  text-align: center;
  margin-top: 24px;
  font-size: 2.5rem;
  color: #333;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin: 40px 0;
  flex-wrap: wrap;
}

.card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
  padding: 32px 24px;
  width: 260px;
  text-align: center;
  transition: transform 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.card:hover {
  transform: translateY(-6px) scale(1.03);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: 'Segoe UI', Arial, sans-serif;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  font-size: 0.95rem;
}

.breadcrumb-item {
  color: #007bff;
  text-decoration: none;
  transition: color 0.2s;
}

.breadcrumb-item:hover {
  color: #0056b3;
  text-decoration: underline;
}

.breadcrumb-separator {
  color: #6c757d;
}

.breadcrumb-current {
  color: #495057;
  font-weight: 500;
}

.sections {
  font-size: 1.25rem;
  font-weight: 600;
}

.valor-total-container {
  display: flex;
  justify-content: center;
  padding: 2rem 2rem 1rem;
}

.valor-total-card {
  background: linear-gradient(135deg, #FFD54F 0%, #8B5E3C 100%);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(255, 213, 79, 0.3);
  padding: 2rem 3rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-width: 400px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.valor-total-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(255, 213, 79, 0.4);
}

.valor-icon {
  font-size: 3rem;
  background: rgba(74, 46, 26, 0.3);
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  backdrop-filter: blur(10px);
}

.valor-content {
  flex: 1;
}

.valor-label {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.valor-amount {
  margin: 0.5rem 0 0;
  font-size: 2.5rem;
  color: #ffffff;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1px;
}
</style>
