<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import api from 'src/api/axios';

interface Movimiento {
  id: number;
  productoNombre: string;
  cantidad: number;
  tipo: string;
  fecha: Date;
}

interface Transferencia {
  id: number;
  cantidad: number | string;
  fecha_transferencia: string | Date;
  producto?: {
    nombre: string;
  };
}

interface ApiResponse {
  items?: Transferencia[];
}

export default defineComponent({
  name: 'MovimientosInventario',
  setup() {
    const loading = ref(true);
    const error = ref<string | null>(null);
    const movimientos = ref<Movimiento[]>([]);

    const cargarMovimientos = async () => {
      try {
        loading.value = true;
        error.value = null;
        
        const response = await api.get('transferencias');
        let transferencias: Transferencia[] = [];
        
        if (Array.isArray(response.data)) {
          transferencias = response.data as Transferencia[];
        } else if (response.data && typeof response.data === 'object' && 'items' in response.data) {
          const apiResp = response.data as ApiResponse;
          transferencias = apiResp.items || [];
        }
        
        // Mapear las transferencias a la interfaz Movimiento
        movimientos.value = transferencias.map((transferencia: Transferencia) => ({
          id: transferencia.id,
          productoNombre: transferencia.producto?.nombre || 'Producto desconocido',
          cantidad: Number(transferencia.cantidad),
          tipo: 'Transferencia',
          fecha: new Date(transferencia.fecha_transferencia)
        }));
      } catch (err) {
        console.error('Error al cargar movimientos:', err);
        error.value = 'Error al obtener los movimientos de inventario';
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      void cargarMovimientos();
    });

    return {
      loading,
      error,
      movimientos,
      cargarMovimientos
    };
  },
});
</script>

<template>
  <div class="movimientos-inventario">
    <div class="header">
      <h1>Historial de Movimientos de Inventario</h1>
      <button @click="cargarMovimientos" class="btn-recargar">🔄 Recargar</button>
    </div>
    <p>Aquí puedes ver el historial completo de transferencias de inventario.</p>

    <div v-if="loading" class="loading">
      <p>Cargando movimientos...</p>
    </div>

    <div v-else>
      <!-- Mostrar errores -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Tabla de movimientos -->
      <table v-if="movimientos.length" class="tabla">
        <thead>
          <tr>
            <th>ID</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Tipo</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="movimiento in movimientos" :key="movimiento.id">
            <td>{{ movimiento.id }}</td>
            <td>{{ movimiento.productoNombre }}</td>
            <td>{{ movimiento.cantidad }}</td>
            <td><span :class="`tipo-${movimiento.tipo.toLowerCase()}`">{{ movimiento.tipo }}</span></td>
            <td>{{ new Date(movimiento.fecha).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>

      <div v-else class="no-data">
        <p>No hay movimientos registrados en este momento.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.movimientos-inventario {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

.header h1 {
  margin: 0;
  color: #333;
}

.btn-recargar {
  background: #4f8cff;
  color: white;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-recargar:hover {
  background: #2563eb;
  transform: translateY(-2px);
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  border-left: 4px solid #c33;
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tabla thead {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
}

.tabla th,
.tabla td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.tabla tbody tr:hover {
  background: #f9f9f9;
}

.tipo-transferencia {
  display: inline-block;
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
  background: #f9f9f9;
  border-radius: 6px;
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .movimientos-inventario {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-recargar {
    width: 100%;
  }

  .tabla {
    font-size: 0.9rem;
  }

  .tabla th,
  .tabla td {
    padding: 0.75rem 0.5rem;
  }
}
</style>
