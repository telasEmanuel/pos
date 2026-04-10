<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import api from '../api/axios';
import { generateOrderPDF } from '../utils/pdfGenerator';
import logo from '../assets/logoT.png';

const props = defineProps({
  show: Boolean,
  orden: Object,
});

const emit = defineEmits(['close', 'edited']);

const estado = ref('pendiente');
const detalles = ref<Array<{ id?: number; producto_id: number | null; producto_nombre?: string; cantidad: number; rollos: number; precio_unitario: number; bodega: number | null; metros_por_rollo: number[]; metros_guardados: number[]; tipo: string; guardado: boolean; medida_ind?: string; medida_gru?: string }>>([])


const proveedor_id = ref<number | null>(null);
const filtros = ref<Array<{ id: number; nombre: string }>>([])

const loading = ref(false);
const generandoPDF = ref(false);

const productoFiltrado = async (): Promise<void> => {
  const response = await api.get('productos/all')
  filtros.value = response.data
  console.log(response.data)
}

const cargarOrdenConProductos = async (nuevaOrden: Record<string, unknown>): Promise<void> => {
  if (!nuevaOrden || !(nuevaOrden as { id?: number }).id) return;

  estado.value = (nuevaOrden as { estado?: string }).estado || 'pendiente';
  proveedor_id.value = (nuevaOrden as { proveedor_id?: number }).proveedor_id || null;

  try {
    const res = await api.get(`ordenes/${(nuevaOrden as { id?: number }).id}`);

    // Intentar cargar metadata de rollos desde sessionStorage
    let rollosMetadata: Record<string, unknown> = {};
    const metadataStr = sessionStorage.getItem(`orden_${(nuevaOrden as { id?: number }).id}_rollos`);
    if (metadataStr) {
      try {
        rollosMetadata = JSON.parse(metadataStr);
      } catch (e) {
        console.warn('No se pudo parsear metadata de rollos', e);
      }
    }

    // Cargar inventarios para buscar metros editados guardados
    let inventariosConDetalles: Array<{ id: number; producto_id: number; bodega_id: number; medida_ind?: string; medida_gru?: string; detalles?: Array<{ cantidad: number }> }> = [];
    let detallesDelInventario: Array<{ producto_id: number; cantidad: number; bodega_id: number }> = [];
    try {
      const invRes = await api.get('inventarios');
      inventariosConDetalles = invRes.data || [];
    } catch (e) {
      console.warn('No se pudo cargar inventarios para verificar detalles guardados', e);
    }

    // Cargar detalles individuales del inventario para obtener TODOS los items guardados
    try {
      const detallesRes = await api.get('inventarios/detalles');
      detallesDelInventario = (detallesRes.data || []);
      console.log(`📋 Detalles del inventario cargados: ${detallesDelInventario.length} items`);
    } catch (e) {
      console.warn('No se pudo cargar detalles del inventario', e);
    }

    detalles.value = (res.data.detalles || []).map((d: { id?: number; producto_id: number; cantidad: number; rollos: number; precio_unitario: number }) => {
      const producto = filtros.value.find(p => p.id === d.producto_id);

      // Obtener metros del metadata de rollos si existen
      let metros: number[] = [];
      if ((rollosMetadata as { rollos?: Array<{ producto_id: number; metros: number[] }> }).rollos) {
        const metros_info = (rollosMetadata as { rollos?: Array<{ producto_id: number; metros: number[] }> }).rollos!.find((r: { producto_id: number }) => r.producto_id === d.producto_id);
        if (metros_info) {
          metros = (metros_info as { metros: number[] }).metros || [];
        }
      }

      // Si es tipo rollos, SIEMPRE asegurar que metros_por_rollo esté inicializado
      const tipo = (d as { tipo?: string }).tipo || 'estandar';

      // DEBUG: Log para entender qué se está recibiendo
      console.log(`📊 Detalle cargado - Producto: ${d.producto_id}, tipo: ${tipo}, rollos: ${d.rollos}, metadata metros.length: ${metros.length}`);

      if (tipo === 'rollos' && d.rollos && d.rollos > 0) {
        if (metros.length === 0) {
          metros = new Array(d.rollos).fill(0);
        }
        // Asegurar que el array tenga exactamente la cantidad de rollos
        if (metros.length < d.rollos) {
          metros = [...metros, ...new Array(d.rollos - metros.length).fill(0)];
        } else if (metros.length > d.rollos) {
          metros = metros.slice(0, d.rollos);
        }
      } else if (metros.length === 0 && d.rollos && d.rollos > 0) {
        // Si no es tipo rollos pero tiene rollos, inicializar array con ceros
        metros = new Array(d.rollos).fill(0);
      }

      // Inicializar metros_guardados como ceros
      const metrosGuardados: number[] = new Array(metros.length).fill(0);

      // Si es tipo rollos, buscar en inventariodetalle cuántos metros ya fueron guardados
      if (tipo === 'rollos' && metros.length > 0) {
        // Buscar TODOS los detalles guardados para este producto (sin filtrar por bodega)
        const detallesGuardadosDelProducto = detallesDelInventario.filter(det => det.producto_id === d.producto_id);

        console.log(`📊 Producto ${d.producto_id}: encontrados ${detallesGuardadosDelProducto.length} detalles guardados`);

        // Asignar los metros guardados a cada posición
        for (let i = 0; i < detallesGuardadosDelProducto.length && i < metrosGuardados.length; i++) {
          const detalle = detallesGuardadosDelProducto[i];
          if (detalle) {
            const cantidad = detalle.cantidad;
            metrosGuardados[i] = typeof cantidad === 'number' ? cantidad : Number(cantidad);
          }
        }

        // Si hay metros guardados y aún no mostramos ninguno en metros, usar los guardados
        if (metros.every(m => m === 0) && metrosGuardados.some(m => m > 0)) {
          metros = [...metrosGuardados];
          console.log(`✅ Recuperados valores guardados para producto ${d.producto_id}:`, metros);
        }
      }

      return {
        id: d.id,
        producto_id: d.producto_id,
        producto_nombre: producto ? producto.nombre : `Producto #${d.producto_id}`,
        cantidad: d.cantidad,
        rollos: d.rollos,
        precio_unitario: d.precio_unitario,
        bodega: (d as { bodega_id?: number }).bodega_id || null,
        metros_por_rollo: metros,
        metros_guardados: metrosGuardados,
        tipo: tipo,
        guardado: (d as { guardado?: boolean }).guardado === true || false,
        medida_ind: inventariosConDetalles.find(inv => inv.producto_id === d.producto_id)?.medida_ind || '',
        medida_gru: inventariosConDetalles.find(inv => inv.producto_id === d.producto_id)?.medida_gru || ''
      };
    });
    loading.value = true;
  } catch (err) {
    console.error('Error al cargar detalles de la orden', err);
    detalles.value = [];
  }
};

watch(
  () => props.orden,
  async (nuevaOrden): Promise<void> => {
    if (!nuevaOrden) return;
    // Si filtros no está cargado aún, esperar a que se cargue
    if (filtros.value.length === 0) {
      return;
    }
    await cargarOrdenConProductos(nuevaOrden as Record<string, unknown>);
  },
  { immediate: true }
);

// Ejecutar cargarOrdenConProductos también cuando filtros se carga
watch(
  () => filtros.value.length,
  async (): Promise<void> => {
    if (props.orden && filtros.value.length > 0) {
      await cargarOrdenConProductos(props.orden as Record<string, unknown>);
    }
  }
);

function eliminarDetalle(index: number): void {
  if (estado.value === 'recibido') {
    alert("Acción denegada, la orden ya fue recibida.");
    return;
  }
  detalles.value.splice(index, 1);
}

const actualizarOrden = async (): Promise<void> => {
  try {
    if (detalles.value.length === 0) {
      alert("La orden debe tener al menos un producto");
      return;
    }

    const primeraBodega = detalles.value.find(d => d.bodega)?.bodega;

    // Preparar detalles para guardar
    const detallesParaGuardar = detalles.value.map(d => ({
      producto_id: Number(d.producto_id),
      cantidad: Number(d.cantidad),
      rollos: Number(d.rollos),
      precio_unitario: Number(d.precio_unitario),
      tipo: d.tipo || 'estandar',
      metros_por_rollo: d.metros_por_rollo && d.metros_por_rollo.length > 0
        ? d.metros_por_rollo.filter((m: number) => m > 0)  // ← Solo metros > 0
        : [],
      guardado: d.guardado || false
    }));

    const payload = {
      proveedor_id: Number(proveedor_id.value),
      estado: estado.value,
      bodega_id: primeraBodega ? Number(primeraBodega) : null,
      detalles: detallesParaGuardar
    };

    console.log("Enviando payload:", payload);

    if (!(props.orden as { id?: number })?.id) throw new Error('Orden no válida');
    const ordenResponse = await api.put(`ordenes/${(props.orden as { id?: number }).id}`, payload);
    console.log("Orden actualizada:", ordenResponse.data);

    // Si se está marcando como recibido y hay bodega, guardar metros en InventarioDetalle
    if (estado.value === 'recibido' && primeraBodega) {
      console.log("📦 Procesando inventario para estado 'recibido'...");

      // Primero, cargar inventarios para mapear producto_id → inventario_id
      let inventariosDisponibles: Array<{ id: number; producto_id: number; bodega_id: number }> = [];
      try {
        const invResponse = await api.get('inventarios');
        inventariosDisponibles = invResponse.data || [];
        console.log(`📋 Inventarios cargados: ${inventariosDisponibles.length} registros`);
      } catch (e) {
        console.warn('⚠️ No se pudo cargar inventarios:', e);
      }

      for (const detalle of detalles.value) {
        // Caso 1: Producto estándar - guardar cantidad total si es > 0
        if (detalle.tipo === 'estandar' && Number(detalle.cantidad) > 0) {
          // Verificar si ya está guardado
          if (detalle.metros_guardados.length === 0 || (detalle.metros_guardados[0] || 0) === 0) {
            try {
              console.log(`📊 Guardando producto estándar ${detalle.producto_id}: ${detalle.cantidad}`);
              await api.post('inventarios/detalles', {
                producto_id: detalle.producto_id,
                cantidad: Number(detalle.cantidad),
                estado: 'DISPONIBLE',
                bodega_id: primeraBodega
              });
              // Marcar como guardado
              detalle.metros_guardados = [Number(detalle.cantidad)];
              console.log(`✅ Guardado: Producto ${detalle.producto_id}`);
            } catch (e) {
              console.warn(`❌ No se pudo guardar detalle de inventario para producto ${detalle.producto_id}:`, e);
            }
          }
        }

        // Caso 2: Producto tipo rollos - guardar solo metros > 0 y que no estén ya guardados
        if (detalle.tipo === 'rollos' && detalle.metros_por_rollo && detalle.metros_por_rollo.length > 0) {
          console.log(`🎯 Procesando ${detalle.metros_por_rollo.length} rollos para producto ${detalle.producto_id}`);
          for (let i = 0; i < detalle.metros_por_rollo.length; i++) {
            const metros = detalle.metros_por_rollo[i] ?? 0;
            const metrosYaGuardados = detalle.metros_guardados[i] ?? 0;

            console.log(`  Rollo ${i + 1}: ${metros}m (guardado: ${metrosYaGuardados}m)`);

            // Solo guardar si: metros > 0 AND no estaba guardado antes (o estaba en 0)
            if (metros > 0 && metrosYaGuardados === 0) {
              try {
                console.log(`  📌 Guardando rollo ${i + 1} con ${metros}m...`);
                const detalleResponse = await api.post('inventarios/detalles', {
                  producto_id: detalle.producto_id,
                  cantidad: metros,
                  estado: 'DISPONIBLE',
                  bodega_id: primeraBodega
                });
                console.log(`  ✅ Rollo ${i + 1} guardado:`, detalleResponse.data);
                // Marcar este rollo como guardado
                if (detalle.metros_guardados.length <= i) {
                  detalle.metros_guardados.push(metros);
                } else {
                  detalle.metros_guardados[i] = metros;
                }
              } catch (e) {
                console.warn(`  ❌ No se pudo guardar rollo ${i + 1} para producto ${detalle.producto_id}:`, e);
              }
            }
          }
        }
      }
    }

    // Guardar metros en sessionStorage para persistencia
    if (estado.value === 'recibido' && (props.orden as { id?: number })?.id) {
      const ordenId = (props.orden as { id?: number }).id;
      const rollosData = detalles.value
        .filter(d => d.tipo === 'rollos' && d.producto_id && d.metros_por_rollo.length > 0)
        .map(d => ({
          producto_id: d.producto_id,
          metros: d.metros_por_rollo
        }));

      if (rollosData.length > 0) {
        const metadata = {
          orden_id: ordenId,
          timestamps: new Date().toISOString(),
          rollos: rollosData
        };
        sessionStorage.setItem(`orden_${ordenId}_rollos`, JSON.stringify(metadata));
        console.log(`💾 Metadata de rollos guardada en sessionStorage para orden ${ordenId}`);
      }
    }

    emit('edited');
    emit('close');
  } catch (error) {
    const err = error as Error | { response?: { data?: { error?: string } } };
    const errorMessage = 'response' in err && err.response?.data?.error || (err instanceof Error ? err.message : 'Error desconocido');
    console.error('Error detallado:', errorMessage);
    alert('Error: ' + errorMessage);
  }
};

onMounted(async (): Promise<void> => {
  await productoFiltrado();
  // Después de cargar productos, cargar la orden si existe
  if (props.orden) {
    await cargarOrdenConProductos(props.orden);
  }
})

const generarMetrosInputs = (index: number): void => {
  const detalle = detalles.value[index];
  if (detalle && !detalle.metros_por_rollo) {
    detalle.metros_por_rollo = new Array(detalle.rollos || 1).fill(0);
  } else if (detalle && detalle.metros_por_rollo.length === 0 && detalle.rollos) {
    detalle.metros_por_rollo = new Array(detalle.rollos).fill(0);
  }
}

const descargarPDF = async (): Promise<void> => {
  try {
    generandoPDF.value = true;

    // Cargar inventarios y proveedores necesarios para el PDF
    const [invResponse, provResponse] = await Promise.all([
      api.get('inventarios'),
      api.get('proveedores')
    ]);

    const inventarios = invResponse.data || [];
    const proveedores = provResponse.data || [];

    // Preparar payload con los detalles actuales
    const detallesParaPDF = detalles.value.map(d => ({
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      rollos: d.rollos,
      precio_unitario: d.precio_unitario,
      tipo: d.tipo,
      measurements: d.metros_por_rollo
    }));

    const payload = {
      proveedor_id: Number(proveedor_id.value),
      estado: estado.value,
      detalles: detallesParaPDF
    };

    // Generar PDF
    await generateOrderPDF(payload, logo, inventarios, proveedores, Number(proveedor_id.value));
  } catch (error) {
    console.error('Error al generar PDF:', error);
  } finally {
    generandoPDF.value = false;
  }
}
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
            <div class="badge" :class="detalle.tipo === 'rollos' ? 'badge-rollos' : 'badge-estandar'">
              {{ detalle.tipo === 'rollos' ? 'Por agrupación' : 'Por unidad' }}
            </div>
            <button class="delete-btn" @click="eliminarDetalle(index)">Eliminar</button>
          </div>
          <div class="detalle-grid">
            <!--<div class="form-field">
              <label>Metros Totales</label>
              <input type="number" placeholder="Metros" v-model.number="detalle.cantidad" />
            </div>-->
            <div class="form-field">
              <label>Cantidad de {{ detalle.medida_gru?.toLowerCase() }}</label>
              <input type="number" placeholder="Rollos" v-model.number="detalle.rollos" :disabled="detalle.guardado" />
            </div>
            <div class="form-field">
              <label>Bodega</label>
              <select v-model.number="detalle.bodega">
                <option value="" disabled>Seleccione una bodega</option>
                <option value="1">Tienda</option>
                <option value="2">Bodega</option>
              </select>
            </div>
          </div>

          <!-- Mostrar metros por rollo solo si es tipo rollos -->
          <div v-if="detalle.tipo === 'rollos' && detalle.rollos && detalle.rollos > 0" class="metros-por-rollo">
            <h4 v-if="estado !== 'recibido' || !detalle.metros_por_rollo || detalle.metros_por_rollo.length === 0">
              Información de items:
            </h4>
            <p v-if="!detalle.metros_por_rollo || detalle.metros_por_rollo.length === 0" class="info-text">
              Se capturarán {{ detalle.medida_ind?.toLowerCase() }} de cada {{ detalle.medida_gru?.toLowerCase() }} al
              marcar como recibido
            </p>
            <!-- Mostrar metros capturados o guardados -->
            <div v-if="estado === 'recibido' && detalle.metros_por_rollo && detalle.metros_por_rollo.length > 0"
              class="metros-grid">
              <div v-for="(metros, rIndex) in detalle.metros_por_rollo" :key="rIndex" class="metro-item">
                <label>Item {{ rIndex + 1 }}</label>
                <div class="metro-value">
                  <!-- Usar metros_guardados si metros_por_rollo está vacío pero hay datos guardados -->
                  <span v-if="metros === 0 && (detalle.metros_guardados[rIndex as number] ?? 0) > 0" class="recibido">
                    ✓ {{ detalle.metros_guardados[rIndex as number] }} {{ detalle.medida_ind?.toLowerCase() }}
                  </span>
                  <span v-else-if="metros === 0" class="no-recibido">⏳ No recibido</span>
                  <span v-else class="recibido">✓ {{ metros }} {{ detalle.medida_ind?.toLowerCase() }}</span>
                </div>
              </div>
            </div>
            <!-- Si metros_por_rollo está vacío pero hay datos en metros_guardados, mostrarlos -->
            <div
              v-if="estado === 'recibido' && (!detalle.metros_por_rollo || detalle.metros_por_rollo.length === 0) && detalle.metros_guardados && detalle.metros_guardados.some((m: number) => m > 0)"
              class="metros-grid">
              <div v-for="(metros, rIndex) in detalle.metros_guardados" :key="rIndex" class="metro-item">
                <label>Item {{ rIndex + 1 }}</label>
                <div class="metro-value">
                  <span v-if="metros > 0" class="recibido">✓ {{ metros }} {{ detalle.medida_ind?.toLowerCase() }}</span>
                  <span v-else class="no-recibido">⏳ No recibido</span>
                </div>
              </div>
            </div>
          </div>

          <!-- UI para capturar metros si está "recibido" y es tipo rollos -->
          <div v-if="detalle.tipo === 'rollos' && estado === 'recibido' && detalle.rollos && detalle.rollos > 0"
            class="captura-metros">
            <h4>Capturar {{ detalle.medida_ind?.toLowerCase() }} de {{ detalle.medida_gru?.toLowerCase() }} recibidos:
            </h4>
            <div v-if="!detalle.metros_por_rollo || detalle.metros_por_rollo.length === 0">
              <button type="button" class="btn-generar" @click="generarMetrosInputs(index)">
                Generar {{ detalle.rollos }} campos de {{ detalle.medida_ind?.toLowerCase() }}
              </button>
            </div>
            <div v-else class="metros-input-grid">
              <div v-for="(metros, rIndex) in detalle.metros_por_rollo" :key="rIndex" class="metro-input">
                <label>Item {{ rIndex + 1 }}</label>
                <div class="metro-wrapper">
                  <span
                    v-if="(detalle.metros_guardados[rIndex as number] ?? 0) > 0 && (metros ?? 0) === (detalle.metros_guardados[rIndex as number] ?? 0)"
                    class="estado-guardado">
                    ✅ {{ metros }} {{ detalle.medida_ind?.toLowerCase() }}
                  </span>
                  <input v-else type="number" step="0.01" min="0"
                    v-model.number="detalle.metros_por_rollo[rIndex as number]" placeholder="0" :class="{
                      'input-pendiente': (metros ?? 0) === 0,
                      'input-nuevo': (metros ?? 0) > 0 && (detalle.metros_guardados[rIndex as number] ?? 0) === 0,
                      'input-actualizado': (metros ?? 0) > 0 && (detalle.metros_guardados[rIndex as number] ?? 0) > 0
                    }" />
                </div>
                <small v-if="(metros ?? 0) === 0" class="info-text">⏳ Pendiente</small>
                <small v-else-if="(detalle.metros_guardados[rIndex as number] ?? 0) === 0" class="info-text">📝 Nuevo -
                  se guardará</small>
                <small v-else-if="(metros ?? 0) !== (detalle.metros_guardados[rIndex as number] ?? 0)"
                  class="info-text">🔄 Actualización</small>
              </div>
            </div>
            <p class="info-mensaje">⚠️ Captura los {{ detalle.medida_ind?.toLowerCase() }} por cada {{
              detalle.medida_gru?.toLowerCase() }}. Los que dejes en 0 no se guardarán en el inventario.</p>
          </div>
        </div>

        <button @click="descargarPDF" :disabled="generandoPDF" class="btn-pdf">{{ generandoPDF ? 'Generando PDF...' :
          'Descargar PDF' }}</button>
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

.modal button:hover:not(:disabled) {
  transform: translateY(-2px);
}

.modal button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.btn-pdf {
  background: linear-gradient(135deg, #4f8cff 0%, #357abd 100%) !important;
  order: -1;
}

/* Badge styles */
.badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-rollos {
  background: #dbeafe;
  color: #1e40af;
}

.badge-estandar {
  background: #f0fdf4;
  color: #166534;
}

/* Metros por rollo display */
.metros-por-rollo {
  margin-top: 1rem;
  padding: 0.8rem;
  background: #f0fdf4;
  border-left: 4px solid #22c55e;
  border-radius: 6px;
}

.metros-por-rollo h4 {
  margin: 0 0 0.6rem 0;
  font-size: 0.9rem;
  color: #166534;
  font-weight: 600;
}

.metros-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.6rem;
}

.metro-item {
  background: #fff;
  padding: 0.4rem;
  border-radius: 6px;
  border: 1px solid #bbf7d0;
  text-align: center;
}

.metro-item label {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.2rem;
  margin-top: 0 !important;
}

.metro-value {
  font-size: 0.95rem;
  font-weight: 600;
}

.recibido {
  color: #16a34a;
}

.no-recibido {
  color: #f59e0b;
}

/* Captura de metros */
.captura-metros {
  margin-top: 1rem;
  padding: 0.8rem;
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  border-radius: 6px;
}

.captura-metros h4 {
  margin: 0 0 0.6rem 0;
  font-size: 0.9rem;
  color: #92400e;
  font-weight: 600;
}

.metros-input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}

.metro-input {
  display: flex;
  flex-direction: column;
}

.metro-input label {
  font-size: 0.8rem;
  color: #92400e;
  font-weight: 600;
  margin-bottom: 0.2rem;
  margin-top: 0 !important;
}

.metro-input input {
  width: 100% !important;
  padding: 0.4rem !important;
  font-size: 0.9rem !important;
  margin-bottom: 0.2rem !important;
}

.metro-wrapper {
  position: relative;
  width: 100%;
}

.estado-guardado {
  display: block;
  padding: 0.5rem;
  background: #dcfce7;
  border: 2px solid #22c55e;
  border-radius: 6px;
  color: #166534;
  font-weight: 600;
  text-align: center;
  font-size: 0.95rem;
}

.input-pendiente {
  background: #fef08a !important;
  border: 2px solid #facc15 !important;
  color: #92400e !important;
}

.input-pendiente:focus {
  border-color: #eab308 !important;
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.15) !important;
}

.input-nuevo {
  background: #dbeafe !important;
  border: 2px solid #3b82f6 !important;
  color: #1e40af !important;
}

.input-nuevo:focus {
  border-color: #2563eb !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
}

.input-actualizado {
  background: #f3e8ff !important;
  border: 2px solid #a855f7 !important;
  color: #581c87 !important;
}

.input-actualizado:focus {
  border-color: #9333ea !important;
  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15) !important;
}

.info-text {
  font-size: 0.7rem;
  color: #b45309;
  display: block;
  font-style: italic;
}

.info-mensaje {
  margin: 0;
  font-size: 0.85rem;
  color: #92400e;
  font-weight: 500;
}

.modal input:disabled,
.modal select:disabled {
  background: #e5e7eb;
  color: #6b7280;
  cursor: not-allowed;
}

.btn-generar {
  background: var(--color-brand-primary) !important;
  color: #fff !important;
  padding: 0.5rem 1rem !important;
  border-radius: 6px !important;
  border: none !important;
  font-weight: 600 !important;
  font-size: 0.9rem !important;
  cursor: pointer !important;
  width: 100% !important;
  margin-bottom: 0.6rem !important;
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
