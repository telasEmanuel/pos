<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import api from '../api/axios';

const props = defineProps({ show: Boolean });
const emit = defineEmits(['close', 'creado']);

const productos = ref<Array<{ id: number; nombre: string; descripcion?: string }>>([])
const producto_id = ref<number | string>('');
const cantidad = ref<number>(1);
const rollos = ref<number>(0);
const bodega_id = ref<number>(1);
const mensaje = ref<string>('');
const error = ref<string>('');
const medida_gru = ref<string>('');
const medida_ind = ref<string>('');

// Nuevas variables para Rollos
const tipoEntrada = ref('estandar'); // 'estandar' | 'rollos'
const cantidadRollosInput = ref(1);
const detallesRollos = ref([0]);

const totalMetrosRollos = computed(() => {
  return detallesRollos.value.reduce((acc, val) => acc + (Number(val) || 0), 0).toFixed(2);
});

const generarInputsRollos = (): void => {
  const n = parseInt(cantidadRollosInput.value as unknown as string) || 0;
  if (n < 0) return;

  // Ajustar tamaño del array conservando valores previos si es posible
  if (n > detallesRollos.value.length) {
    const nuevos = new Array(n - detallesRollos.value.length).fill(0);
    detallesRollos.value = [...detallesRollos.value, ...nuevos];
  } else if (n < detallesRollos.value.length) {
    detallesRollos.value = detallesRollos.value.slice(0, n);
  }
};

// Variables para el buscador
const busquedaProducto = ref('');
const mostrarSugerencias = ref(false);
const productoSeleccionado = ref<{ id: number; nombre: string; descripcion?: string } | null>(null);

watch(() => props.show, (newVal) => {
  if (newVal) {
    // Resetear valores cuando se abra modal
    producto_id.value = '';
    cantidad.value = 1;
    bodega_id.value = 1;
    rollos.value = 0;
    medida_gru.value = '';
    medida_ind.value = '';
    mensaje.value = '';
    error.value = '';
    busquedaProducto.value = '';
    mostrarSugerencias.value = false;
    productoSeleccionado.value = null;

    // Reset nuevos valores
    tipoEntrada.value = 'estandar';
    cantidadRollosInput.value = 0;
    detallesRollos.value = [0];
  }
});

// Computed para filtrar productos según la búsqueda
const productosFiltrados = computed(() => {
  if (!busquedaProducto.value || busquedaProducto.value.length < 2) {
    return [];
  }

  const termino = busquedaProducto.value.toLowerCase();
  return productos.value
    .filter(producto =>
      producto.nombre.toLowerCase().includes(termino) ||
      (producto.descripcion && producto.descripcion.toLowerCase().includes(termino))
    )
    .slice(0, 10); // Limitar a 10 sugerencias
});

// Función para seleccionar un producto
const seleccionarProducto = (producto: { id: number; nombre: string; descripcion?: string }): void => {
  productoSeleccionado.value = producto;
  producto_id.value = producto.id;
  busquedaProducto.value = producto.nombre;
  mostrarSugerencias.value = false;
};

// Función para manejar el input de búsqueda
const onBusquedaInput = (): void => {
  if (busquedaProducto.value.length >= 2) {
    mostrarSugerencias.value = true;
    productoSeleccionado.value = null;
    producto_id.value = '';
  } else {
    mostrarSugerencias.value = false;
  }
};

// Función para ocultar sugerencias cuando se hace clic fuera
const ocultarSugerencias = (): void => {
  setTimeout(() => {
    mostrarSugerencias.value = false;
  }, 200); // Delay para permitir clicks en sugerencias
};

const crearInventario = async (): Promise<void> => {
  if (!producto_id.value) {
    error.value = 'Por favor selecciona un producto válido';
    return;
  }

  try {
    let payload = {};

    if (tipoEntrada.value === 'rollos') {
      // Validación básica
      if (detallesRollos.value.some(m => m <= 0)) {
        error.value = 'Por favor ingresa medidas válidas para todos los rollos';
        return;
      }

      payload = {
        producto_id: producto_id.value,
        bodega_id: bodega_id.value,
        cantidad: totalMetrosRollos.value, // Total metros calculado
        rollos: cantidadRollosInput.value,
        medida_ind: 'Metros',
        medida_gru: 'Rollos',
        detalles: detallesRollos.value // Array de medidas
      };
    } else {
      // Modo Estandar
      const isBodega = bodega_id.value === 2;
      payload = {
        producto_id: producto_id.value,
        bodega_id: bodega_id.value,
        cantidad: cantidad.value,
        rollos: isBodega ? cantidad.value : rollos.value,
        medida_ind: medida_ind.value,
        medida_gru: isBodega ? medida_ind.value : medida_gru.value
      };
    }

    await api.post('inventarios', payload);
    mensaje.value = 'Inventario creado correctamente';
    emit('creado');
    emit('close');
  } catch (err) {
    console.error(err);
    error.value = 'Error al crear inventario';
  }
};

onMounted(async () => {
  try {
    const res = await api.get('productos/all');
    productos.value = res.data.items || res.data;
  } catch {
    error.value = 'Error al cargar productos';
  }
});
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>Nuevo Inventario</h2>
      <form @submit.prevent="crearInventario">

        <!-- Buscador de productos -->
        <div class="producto-search">
          <label>Buscar Producto:</label>
          <div class="search-container">
            <input type="text" v-model="busquedaProducto" @input="onBusquedaInput" @focus="onBusquedaInput"
              @blur="ocultarSugerencias" placeholder="Escribe el nombre del producto..." autocomplete="off" required />

            <!-- Lista de sugerencias -->
            <div v-if="mostrarSugerencias && productosFiltrados.length" class="sugerencias">
              <div v-for="producto in productosFiltrados" :key="producto.id" @click="seleccionarProducto(producto)"
                class="sugerencia-item">
                <div class="producto-nombre">{{ producto.nombre }}</div>
                <div class="producto-descripcion">{{ producto.descripcion || 'Sin ficha técnica' }}</div>
              </div>
            </div>

            <!-- Mensaje cuando no hay resultados -->
            <div v-if="mostrarSugerencias && busquedaProducto.length >= 2 && !productosFiltrados.length"
              class="no-resultados">
              No se encontraron productos
            </div>
          </div>

          <!-- Producto seleccionado -->
          <div v-if="productoSeleccionado" class="producto-seleccionado">
            <span class="check-icon">✓</span>
            <strong>Seleccionado:</strong> {{ productoSeleccionado.nombre }}
          </div>
        </div>

        <div>
          <label>Ubicación:</label>
          <select v-model.number="bodega_id" required>
            <option value="1">Tienda</option>
            <option value="2">Bodega</option>
          </select>
        </div>

        <div class="tipo-entrada-selector">
          <label>Tipo de Entrada:</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" v-model="tipoEntrada" value="estandar"> Por unidad
            </label>
            <label class="radio-label">
              <input type="radio" v-model="tipoEntrada" value="rollos"> Por agrupación
            </label>
          </div>
        </div>

        <div class="input-row" v-if="tipoEntrada === 'estandar'">
          <div class="input-half">
            <label>Cantidad:</label>
            <input type="number" min="0" step="0.01" v-model.number="cantidad" placeholder="0.00" required />
          </div>

          <div class="input-half">
            <label>Unidad de Medida:</label>
            <select v-model="medida_ind" required>
              <option value="" disabled>Seleccione unidad</option>
              <option value="Metros">Metros</option>
              <option value="Piezas">Piezas</option>
              <option value="Litros">Litros</option>
              <option value="Kilos">Kilos</option>
              <option value="Bolsas">Bolsas</option>
              <option value="Planchas">Planchas</option>
            </select>
          </div>
        </div>

        <!-- UI para Rollos de Tela -->
        <div v-else-if="tipoEntrada === 'rollos'">
          <div class="input-row">
            <div class="input-half">
              <label>Cantidad de Rollos:</label>
              <input type="number" min="1" step="1" v-model.number="cantidadRollosInput" @input="generarInputsRollos"
                placeholder="Ej: 3" required />
            </div>
            <div class="input-half">
              <label>Total Metros (Calculado):</label>
              <div class="readonly-value">{{ totalMetrosRollos }} m</div>
            </div>
          </div>

          <div class="rollos-inputs-grid" v-if="detallesRollos.length > 0">
            <div v-for="(rollo, index) in detallesRollos" :key="index" class="rollo-input-item">
              <label>Rollo {{ index + 1 }} (m):</label>
              <input type="number" step="0.01" min="0" v-model.number="detallesRollos[index]" placeholder="0.00"
                required />
            </div>
          </div>
        </div>

        <div class="buttons">
          <button type="submit" :disabled="!producto_id">Guardar</button>
          <button type="button" @click="$emit('close')">Cancelar</button>
        </div>
      </form>

      <p v-if="mensaje" class="mensaje">{{ mensaje }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
h2 {
  color: #333;
  font-size: 1.8rem;
  margin: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(40, 48, 63, 0.35);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  padding: 2.5rem 2rem 2rem 2rem;
  border-radius: 18px;
  width: 420px;
  max-width: 95vw;
  box-shadow: 0 8px 32px rgba(60, 60, 90, 0.18);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  animation: modalIn 0.25s;
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
  margin-bottom: 1.2rem;
  color: var(--color-brand-primary);
  font-weight: 600;
  text-align: center;
}

form>div {
  margin-bottom: 1rem;
}

.producto-search {
  margin-bottom: 1.5rem;
}

.search-container {
  position: relative;
}

.sugerencias {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #d1d5db;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sugerencia-item {
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.2s;
}

.sugerencia-item:hover {
  background: #f8fafc;
}

.sugerencia-item:last-child {
  border-bottom: none;
}

.producto-nombre {
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.producto-descripcion {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.2;
}

.no-resultados {
  padding: 1rem;
  text-align: center;
  color: #6b7280;
  font-style: italic;
  background: #f9fafb;
  border: 1px solid #d1d5db;
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.producto-seleccionado {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #ecfdf5;
  border: 1px solid var(--color-brand-primary);
  border-radius: 6px;
  color: var(--color-brand-secondary);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.check-icon {
  color: var(--color-brand-primary);
  font-weight: bold;
}

.input-row {
  display: flex;
  gap: 1rem;
}

.input-half {
  flex: 1;
}

label {
  display: block;
  margin-bottom: 0.3rem;
  color: #444;
  font-size: 0.97rem;
  font-weight: 500;
}

input,
select {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 1rem;
  background: #f7fafc;
  transition: border 0.2s;
}

input:focus,
select:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #fff;
}

.search-container input:focus {
  border-radius: 7px 7px 0 0;
}

.buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 1rem;
}

button[type="submit"] {
  background: var(--gradient-brand-90);
  color: #fff;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  flex: 1;
}

button[type="submit"]:hover:not(:disabled) {
  background: var(--color-brand-secondary);
}

button[type="submit"]:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

button[type="button"] {
  background: #f3f4f6;
  color: #333;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  flex: 1;
}

button[type="button"]:hover {
  background: #e5e7eb;
}

.mensaje {
  margin-top: 1rem;
  text-align: center;
  font-weight: 500;
  color: green;
}

.error {
  margin-top: 1rem;
  text-align: center;
  font-weight: 500;
  color: red;
}

@media (max-width: 480px) {
  .modal {
    width: 95vw;
    padding: 1.5rem 1rem;
  }

  .input-row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .sugerencias {
    max-height: 150px;
  }
}

.tipo-entrada-selector {
  margin-bottom: 1.2rem;
}

.radio-group {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.5rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  color: #374151;
}

.radio-label input {
  width: auto;
  margin: 0;
}

.readonly-value {
  padding: 0.55rem 0.7rem;
  background: #e5e7eb;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-weight: 600;
  color: #374151;
}

.rollos-inputs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.rollo-input-item label {
  font-size: 0.85rem;
  color: #6b7280;
}
</style>
