<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import api from '../api/axios';

const props = defineProps({
  show: Boolean,
  orden: Object,
});

const emit = defineEmits(['close', 'edited']);

const estado = ref('pendiente');
const detalles = ref<Array<{ id?: number; producto_id: number | null; producto_nombre?: string; cantidad: number; rollos: number; precio_unitario: number; bodega?: number }>>([])
const proveedor_id = ref<number | null>(null);
const filtros = ref<Array<{ id: number; nombre: string }>>([])

const loading = ref(false);

const productoFiltrado = async (): Promise<void> => {
  const response = await api.get('productos/all')
  filtros.value = response.data
  console.log(response.data)
}

watch(
  () => props.orden,
  async (nuevaOrden): Promise<void> => {
    if (nuevaOrden && (nuevaOrden as { id?: number }).id) {
      estado.value = (nuevaOrden as { estado?: string }).estado || 'pendiente';
      proveedor_id.value = (nuevaOrden as { proveedor_id?: number }).proveedor_id || null;

      try {
        const res = await api.get(`ordenes/${(nuevaOrden as { id?: number }).id}`);
        detalles.value = (res.data.detalles || []).map((d: { id?: number; producto_id: number; cantidad: number; rollos: number; precio_unitario: number; medida_ind?: string; medida_gru?: string }) => {
          const producto = filtros.value.find(p => p.id === d.producto_id);
          return {
            id: d.id,
            producto_id: d.producto_id,
            producto_nombre: producto ? producto.nombre : 'Producto no encontrado',
            cantidad: d.cantidad,
            rollos: d.rollos,
            precio_unitario: d.precio_unitario,
            /*medida_ind: d.medida_ind || '',
            medida_gru: d.medida_gru || ''*/
          };
        });
        loading.value = true;
      } catch (err) {
        console.error('Error al cargar detalles de la orden', err);
        detalles.value = [];
      }
    }
  },
  { immediate: true }
);

function agregarDetalle(): void {
  if (estado.value === 'recibido') {
    alert("Acción denegada, la orden ya fue recibida.");
    return;
  }
  detalles.value.push({ producto_id: null, cantidad: 1, rollos: 1, precio_unitario: 0 });
}

function eliminarDetalle(index: number): void {
  if (estado.value === 'recibido') {
    alert("Acción denegada, la orden ya fue recibida.");
    return;
  }
  detalles.value.splice(index, 1);
}

const actualizarOrden = async (): Promise<void> => {
  try {
    // 1. Validar que tengamos al menos un detalle y que no esté marcado como recibido
    if (detalles.value.length === 0) {
      alert("La orden debe tener al menos un producto");
      return;
    } /*else if (estado.value === 'recibido') {
      alert("Acción denegada, la orden ya fue recibida.");
      return;
    }*/

    // 2. Buscar la bodega. Si el estado es recibido, necesitamos una bodega válida.
    // Buscamos en el primer detalle que tenga el campo 'bodega' lleno.
    const primeraBodega = detalles.value.find(d => d.bodega)?.bodega;

    const payload = {
      proveedor_id: Number(proveedor_id.value),
      estado: estado.value,
      // Aseguramos que bodega_id sea un número o null, nunca NaN
      bodega_id: primeraBodega ? Number(primeraBodega) : null,
      detalles: detalles.value.map(d => ({
        producto_id: Number(d.producto_id),
        cantidad: Number(d.cantidad),
        rollos: Number(d.rollos),
        precio_unitario: Number(d.precio_unitario)
      }))
    };

    console.log("Enviando payload:", payload); // Revisa esto en la consola F12

    if (!(props.orden as { id?: number })?.id) throw new Error('Orden no válida');
    await api.put(`ordenes/${(props.orden as { id?: number }).id}`, payload);

    emit('edited');
    emit('close');
  } catch (error) {
    const err = error as Error | { response?: { data?: { error?: string } } };
    const errorMessage = 'response' in err && err.response?.data?.error || (err instanceof Error ? err.message : 'Error desconocido');
    console.error('Error detallado:', errorMessage);
    alert('Error: ' + errorMessage);
  }
};

onMounted((): void => {
  void productoFiltrado();
})
</script>

<template>
  <div v-if="show" class="modal-backdrop">
    <div class="modal">
      <div class="modal-scroll">
        <h2>Editar Orden de Compra #{{ props.orden?.id }}</h2>

        <label>Proveedor ID:</label>
        <input type="number" v-model="proveedor_id" />

        <label>Estado:</label>
        <select v-model="estado" id="selectorEstado">
          <option value="pendiente">Pendiente</option>
          <option value="recibido">Recibido</option>
        </select>

        <h3>Detalles</h3>
        <div v-if="!loading">
          <p>Cargando detalles...</p>
        </div>
        <div v-for="(detalle, index) in detalles" :key="detalle.id || index" class="detalle-card">
          <div class="detalle-header">
            <div class="producto-title">{{ detalle.producto_nombre || detalle.producto_id }}</div>
            <button class="delete-btn" @click="eliminarDetalle(index)">Eliminar</button>
          </div>
          <div class="detalle-grid">
            <div class="form-field">
              <label>Metros</label>
              <input type="number" placeholder="Metros" v-model.number="detalle.cantidad" />
            </div>
            <div class="form-field" v-if="detalle.cantidad !== detalle.rollos">
              <label>Rollos</label>
              <input type="number" placeholder="Rollos" v-model.number="detalle.rollos" />
            </div>
            <!--<div class="form-field">
              <label>Precio Unitario</label>
              <input type="number" placeholder="Precio Unitario" v-model.number="detalle.precio_unitario" />
            </div>-->
            <div class="form-field">
              <label>Bodega</label>
              <select v-model.number="detalle.bodega">
                <option value="" disabled>Seleccione una bodega</option>
                <option value="1">Tienda</option>
                <option value="2">Bodega</option>
              </select>
            </div>
          </div>
        </div>

        <button @click="agregarDetalle">Agregar Producto</button>
        <br /><br />

        <button @click="actualizarOrden">Guardar Cambios</button>
        <button @click="$emit('close')">Cancelar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(40, 48, 63, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  padding: 0;
  border-radius: 14px;
  width: 90vw;
  max-width: 720px;
  max-height: 90vh;
  box-shadow: 0 8px 32px rgba(60, 60, 90, 0.18);
  display: flex;
  flex-direction: column;
  animation: modalIn 0.25s;
  overflow: hidden;
}

.modal-scroll {
  padding: 1.5rem 1.2rem 1.2rem 1.2rem;
  overflow-y: auto;
  overflow-x: auto;
  max-height: 85vh;
}

@keyframes modalIn {
  from {
    transform: translateY(40px) scale(0.97);
    opacity: 0;
  }

  to {
    transform: none;
    opacity: 1;
  }
}

.modal h2 {
  margin-bottom: 1rem;
  color: var(--color-brand-primary);
  font-weight: 600;
  text-align: center;
  font-size: 1.15rem;
}

.modal label {
  display: block;
  margin-bottom: 0.2rem;
  color: #444;
  font-size: 0.95rem;
  font-weight: 500;
  margin-top: 0.7rem;
}

.modal input {
  width: 95%;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.97rem;
  background: #f7fafc;
  transition: border 0.2s;
  margin-bottom: 0.5rem;
}

.modal select {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.97rem;
  background: #f7fafc;
  transition: border 0.2s;
  margin-bottom: 0.5rem;
}

.modal input:focus,
.modal select:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #fff;
}

/* Detalle card styles */
.detalle-card {
  margin-bottom: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(60, 60, 90, 0.10);
  padding: 0.8rem 0.9rem;
}

.detalle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.producto-title {
  font-size: 0.98rem;
  font-weight: 600;
  color: #1f2937;
}

.delete-btn {
  background: #ff4f4f;
  color: #fff;
  border: none;
  padding: 0.35rem 0.8rem;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, transform 0.12s;
}

.delete-btn:hover {
  background: #d7263d;
  transform: translateY(-1px);
}

.detalle-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 640px) {
  .detalle-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.form-field label {
  display: block;
  margin-bottom: 0.25rem;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 600;
}

.form-field input,
.form-field select {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  background: #f9fafb;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.form-field input:focus,
.form-field select:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.15);
}

.modal button {
  background: var(--gradient-brand-90);
  color: #fff;
  border: none;
  padding: 0.5rem 1.1rem;
  border-radius: 7px;
  font-weight: 600;
  font-size: 0.97rem;
  margin-right: 8px;
  margin-top: 8px;
  cursor: pointer;
  transition: background 0.2s, transform 0.12s;
}

.modal button:hover {
  background: var(--color-brand-secondary);
  transform: translateY(-2px) scale(1.03);
}

.modal button:last-child {
  background: #FFF9E6;
  color: var(--color-brand-secondary);
  margin-right: 0;
}

.modal button:last-child:hover {
  background: #e5e7eb;
  color: #111;
}
</style>
