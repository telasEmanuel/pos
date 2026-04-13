<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import api from 'src/api/axios'

interface Producto {
  id: number
  nombre: string
  precio: string | number
  [key: string]: unknown
}

const $q = useQuasar()

// Inputs del usuario
const precioProveedor = ref(0)
const precioDinamico = ref(0)
const incremento1 = ref(0)
const incremento2 = ref(0)

// Validar y limpiar valores
const validarNumero = (valor: number | null | undefined): number => {
  if (valor === null || valor === undefined || isNaN(Number(valor))) {
    return 0
  }
  return Number(valor) >= 0 ? Number(valor) : 0
}

// Productos
const productos = ref<Producto[]>([])
const productoSeleccionado = ref<Producto | null>(null)
const cargandoProductos = ref(false)
const actualizando = ref(false)

// IVA fijo
const IVA_FIJO = 16

// Computed para cada paso del cálculo
const paso1ConIVA = computed(() => {
  const precio = validarNumero(precioProveedor.value)
  return precio * (1 + IVA_FIJO / 100)
})

const paso2ConDinamico = computed(() => {
  const paso1 = validarNumero(paso1ConIVA.value)
  const dinamico = validarNumero(precioDinamico.value)
  return paso1 + dinamico
})

const paso3ConIncremento1 = computed(() => {
  const paso2 = validarNumero(paso2ConDinamico.value)
  const incremento = validarNumero(incremento1.value)
  return paso2 * (1 + incremento / 100)
})

const paso4Final = computed(() => {
  const paso3 = validarNumero(paso3ConIncremento1.value)
  const incremento = validarNumero(incremento2.value)
  return paso3 * (1 + incremento / 100)
})

// Cargar productos al montar
const cargarProductos = async () => {
  try {
    cargandoProductos.value = true
    const response = await api.get('productos/all')
    productos.value = Array.isArray(response.data) ? response.data : [response.data]
  } catch (error) {
    console.error('Error al cargar productos:', error)
    $q.notify({
      type: 'negative',
      message: 'Error al cargar productos',
      position: 'top'
    })
  } finally {
    cargandoProductos.value = false
  }
}

// Actualizar precio del producto
const actualizarPrecioProducto = async () => {
  const producto = productoSeleccionado.value
  if (!producto) {
    $q.notify({
      type: 'warning',
      message: 'Selecciona un producto',
      position: 'top'
    })
    return
  }

  if (paso4Final.value <= 0) {
    $q.notify({
      type: 'warning',
      message: 'Calcula un precio válido primero',
      position: 'top'
    })
    return
  }

  try {
    actualizando.value = true
    await api.put(`/productos/${producto.id}`, {
      ...producto,
      precio_comp: paso2ConDinamico.value,
      precio_tap: paso3ConIncremento1.value,
      precio: paso4Final.value
    })

    $q.notify({
      type: 'positive',
      message: `Precios actualizados correctamente`,
      position: 'top'
    })

    // Actualizar en la lista local
    const index = productos.value.findIndex(p => p.id === producto.id)
    if (index !== -1 && productos.value[index]) {
      productos.value[index].precio = paso4Final.value
    }
  } catch (error) {
    console.error('Error al actualizar precios:', error)
    $q.notify({
      type: 'negative',
      message: 'Error al actualizar los precios',
      position: 'top'
    })
  } finally {
    actualizando.value = false
  }
}

const limpiar = () => {
  precioProveedor.value = 0
  precioDinamico.value = 0
  incremento1.value = 0
  incremento2.value = 0
}

onMounted(async () => {
  await cargarProductos()
})
</script>

<template>
  <div class="calculadora-container">
    <h2>Calculadora de Precios</h2>

    <div class="calculadora-contenedor">
      <!-- Fila 1: Input 1 | Paso 1 -->
      <div class="fila-calculo">
        <div class="columna-input">
          <div class="input-group">
            <label for="precio-proveedor">Precio de venta proveedor</label>
            <input type="number" id="precio-proveedor" v-model.number="precioProveedor" step="0.01" min="0"
              @blur="precioProveedor = validarNumero(precioProveedor)" placeholder="Ej: 50.00">
          </div>
        </div>
        <div class="columna-paso" v-if="precioProveedor > 0">
          <div class="paso">
            <div class="paso-titulo">Paso 1: Aplicar IVA 16%</div>
            <div class="paso-formula">{{ precioProveedor.toFixed(2) }} × 16% = {{ paso1ConIVA.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <!-- Fila 2: Input 2 | Paso 2 -->
      <div class="fila-calculo">
        <div class="columna-input">
          <div class="input-group">
            <label for="precio-dinamico">Costo flete</label>
            <input type="number" id="precio-dinamico" v-model.number="precioDinamico" step="0.01" min="0"
              @blur="precioDinamico = validarNumero(precioDinamico)" placeholder="Ej: 5.00">
          </div>
        </div>
        <div class="columna-paso" v-if="precioProveedor > 0">
          <div class="paso">
            <div class="paso-titulo">Paso 2: Sumar el costo relativo a un mt/lt/pz del total del flete </div>
            <div class="paso-formula">{{ paso1ConIVA.toFixed(2) }} + {{ precioDinamico.toFixed(2) }} = {{
              paso2ConDinamico.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <!-- Fila 3: Input 3 | Paso 3 -->
      <div class="fila-calculo">
        <div class="columna-input">
          <div class="input-group">
            <label for="incremento1">Porcentaje de incremento precio tapicero</label>
            <input type="number" id="incremento1" v-model.number="incremento1" step="0.01" min="0"
              @blur="incremento1 = validarNumero(incremento1)" placeholder="Ej: 20">
          </div>
        </div>
        <div class="columna-paso" v-if="precioProveedor > 0">
          <div class="paso">
            <div class="paso-titulo">Paso 3: Aplicar incremento porcentaje tapicero ({{ incremento1 }}%)</div>
            <div class="paso-formula">{{ paso2ConDinamico.toFixed(2) }} × {{ (incremento1) }}% = {{
              paso3ConIncremento1.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <!-- Fila 4: Input 4 | Paso 4 -->
      <div class="fila-calculo">
        <div class="columna-input">
          <div class="input-group">
            <label for="incremento2">Porcentaje de incremento precio público</label>
            <input type="number" id="incremento2" v-model.number="incremento2" step="0.01" min="0"
              @blur="incremento2 = validarNumero(incremento2)" placeholder="Ej: 15">
          </div>
        </div>
        <div class="columna-paso" v-if="precioProveedor > 0">
          <div class="paso">
            <div class="paso-titulo">Paso 4: Aplicar incremento porcentaje público ({{ incremento2 }}%)</div>
            <div class="paso-formula">{{ paso3ConIncremento1.toFixed(2) }} × {{ incremento2 }}% = {{
              paso4Final.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <!-- Fila 5: Botón | Resultado Final -->
      <div class="fila-final">
        <div class="columna-input">
          <button type="button" @click="limpiar" class="btn-limpiar">Limpiar</button>
        </div>
        <div class="columna-resultado" v-if="precioProveedor > 0">
          <div class="resultado-final">
            <h4>Precio Final</h4>
            <div class="precio">$ {{ paso4Final.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <!-- Fila 6: Selector de Producto y Actualizar -->
      <div v-if="paso4Final > 0" class="fila-producto"
        style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb;">
        <div class="columna-input">
          <div class="input-group">
            <label for="producto">Seleccionar Producto</label>
            <select id="producto" v-model="productoSeleccionado" class="select-producto" :disabled="cargandoProductos">
              <option :value="null" selected>Elige un producto...</option>
              <option v-for="prod in productos" :key="prod.id" :value="prod">
                {{ prod.nombre }} (Precio actual: ${{ parseFloat(String(prod.precio)).toFixed(2) }})
              </option>
            </select>
          </div>
          <button v-if="productoSeleccionado" type="button" @click="actualizarPrecioProducto" :disabled="actualizando"
            class="btn-actualizar">
            {{ actualizando ? 'Actualizando...' : 'Actualizar Precio' }}
          </button>
        </div>
        <div class="columna-infoproducto" v-if="productoSeleccionado">
          <div class="info-producto">
            <div class="info-item">
              <span class="label">Producto:</span>
              <span class="valor">{{ productoSeleccionado.nombre }}</span>
            </div>
            <div class="separator"></div>
            <div class="info-item">
              <span class="label">Nuevo precio de compra:</span>
              <span class="valor">${{ paso2ConDinamico.toFixed(2) }}</span>
            </div>
            <div class="info-item">
              <span class="label">Nuevo precio al tapicero:</span>
              <span class="valor">${{ paso3ConIncremento1.toFixed(2) }}</span>
            </div>
            <div class="info-item">
              <span class="label">Nuevo precio al público:</span>
              <span class="valor nuevo">${{ paso4Final.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calculadora-container {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(60, 60, 90, 0.18);
}

.calculadora-container h2 {
  text-align: center;
  color: var(--color-brand-primary);
  margin-bottom: 2rem;
  font-weight: 600;
  font-size: 1.5rem;
}

.calculadora-contenedor {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.fila-calculo {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.fila-final {
  display: flex;
  gap: 2rem;
  align-items: center;
  margin-top: 1rem;
}

.columna-input {
  flex: 0 0 350px;
}

.columna-paso {
  flex: 1;
}

.columna-resultado {
  flex: 1;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.input-group label {
  font-weight: 500;
  color: #444;
  font-size: 0.95rem;
}

.input-group input {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  background: #f7fafc;
  transition: all 0.2s;
}

.input-group input:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(217, 164, 65, 0.1);
}

.btn-limpiar {
  width: 100%;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  background: #e5e7eb;
  color: #374151;
}

.btn-limpiar:hover {
  background: #d1d5db;
}

/* Pasos */
.paso {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid var(--color-brand-primary);
  height: 100%;
}

.paso-titulo {
  font-weight: 600;
  color: #374151;
  font-size: 0.95rem;
  margin-bottom: 0.4rem;
}

.paso-formula {
  font-family: 'Courier New', monospace;
  color: #6b7280;
  font-size: 0.9rem;
  padding: 0.5rem;
  background: #fff;
  border-radius: 4px;
  word-break: break-word;
  line-height: 1.4;
}

.resultado-final {
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(217, 164, 65, 0.1), rgba(217, 164, 65, 0.05));
  border-radius: 12px;
  border: 2px solid var(--color-brand-primary);
  text-align: center;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.resultado-final h4 {
  color: #374151;
  font-size: 0.95rem;
  margin: 0 0 0.5rem 0;
  font-weight: 500;
}

.resultado-final .precio {
  color: var(--color-brand-primary);
  font-size: 2rem;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

/* Selector de Producto */
.fila-producto {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.columna-infoproducto {
  flex: 1;
}

.select-producto {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  background: #f7fafc;
  cursor: pointer;
  transition: all 0.2s;
}

.select-producto:focus {
  border-color: var(--color-brand-primary);
  outline: none;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(217, 164, 65, 0.1);
}

.select-producto:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-actualizar {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-brand-primary);
  color: #fff;
}

.btn-actualizar:hover:not(:disabled) {
  background: #d8a044;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(217, 164, 65, 0.3);
}

.btn-actualizar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-producto {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--color-brand-primary);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.separator {
  height: 1px;
  background: #e5e7eb;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.info-item .label {
  font-weight: 600;
  color: #6b7280;
  font-size: 0.95rem;
}

.info-item .valor {
  color: #374151;
  font-weight: 500;
  font-size: 1rem;
  text-align: right;
}

.info-item .valor.nuevo {
  color: var(--color-brand-primary);
  font-weight: 700;
  font-size: 1.1rem;
}

@media (max-width: 900px) {
  .fila-calculo {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .fila-final {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .fila-producto {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .columna-input,
  .columna-paso,
  .columna-resultado,
  .columna-infoproducto {
    flex: none;
  }
}

@media (max-width: 480px) {
  .calculadora-container {
    margin: 1rem;
    padding: 1rem;
  }

  .columna-input {
    flex: 0 0 100%;
  }

  .input-group input {
    font-size: 16px;
  }

  .resultado-final .precio {
    font-size: 1.5rem;
  }

  .info-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .info-item .valor {
    text-align: left;
  }
}
</style>
