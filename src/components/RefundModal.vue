<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import api from 'src/api/axios';

interface DetalleVenta {
    id: number;
    producto_id: number;
    cantidad: number;
    precio_unitario: number;
    medida?: string;
    producto?: {
        nombre: string;
    };
}

interface Venta {
    id: number;
    cliente: string | null;
    total: number;
    metodo_pago: string;
    fecha_venta: string;
    detallesVenta: DetalleVenta[];
}

interface RefundItem {
    producto_id: number;
    nombre: string;
    cantidadOriginal: number;
    cantidadADevolver: number;
    medida: string;
    precio_unitario: number;
}

interface RefundPayload {
    venta_id: number;
    motivo: string;
    reembolsos: Array<{
        producto_id: number;
        cantidad: number;
        precio_unitario: number;
    }>;
    monto_total_reembolso: number;
}

const $q = useQuasar();

const props = defineProps<{
    venta?: Venta;
    productosMap?: Map<number, string>;
    medidasMap?: Map<number, string>;
}>();

const emit = defineEmits<{
    refund: [data: { motivo: string; reembolsos: RefundItem[]; montoTotal: number }];
}>();

// Modal control
const show = ref(false);
const ventaActual = ref<Venta | null>(null);

// Form data
const motivo = ref('');
const detallesReembolso = ref<RefundItem[]>([]);
const procesando = ref(false);
const erroresValidacion = ref<Set<string>>(new Set());

// Agregar/remover errores de validación
const agregarError = (productoId: number) => {
    erroresValidacion.value.add(`${productoId}`);
};

const removerError = (productoId: number) => {
    erroresValidacion.value.delete(`${productoId}`);
};

// Computed
const montoTotalReembolso = computed(() => {
    return detallesReembolso.value.reduce((sum, item) => {
        return sum + (item.cantidadADevolver * item.precio_unitario);
    }, 0);
});

const todosDesdeActual = computed(() => {
    return detallesReembolso.value.every((item) => item.cantidadADevolver === 0);
});

const algunoSeleccionado = computed(() => {
    return detallesReembolso.value.some((item) => item.cantidadADevolver > 0);
});

const hayErrores = computed(() => {
    return erroresValidacion.value.size > 0;
});

const getProductoNombre = (productoId: number): string => {
    return props.productosMap?.get(productoId) || `Producto #${productoId}`;
};

const getProductoMedida = (productoId: number): string => {
    return props.medidasMap?.get(productoId) || 'pieza';
};

const abrirModal = async (venta: Venta) => {
    // Guardar la venta actual
    ventaActual.value = venta;

    // Limpiar el estado ANTES de abrir el modal
    motivo.value = '';
    detallesReembolso.value = [];

    // Esperar a que se actualice el DOM
    await nextTick();

    // Ahora inicializar con los detalles de la venta correcta
    detallesReembolso.value = (venta.detallesVenta || []).map((detalle) => ({
        producto_id: detalle.producto_id,
        nombre: getProductoNombre(detalle.producto_id),
        cantidadOriginal: Number(detalle.cantidad),
        cantidadADevolver: 0,
        medida: detalle.medida || getProductoMedida(detalle.producto_id),
        precio_unitario: Number(detalle.precio_unitario),
    }));

    // Abrir el modal al final
    show.value = true;
};

const cerrarModal = () => {
    show.value = false;
    motivo.value = '';
    detallesReembolso.value = [];
    ventaActual.value = null;
    erroresValidacion.value.clear();
};

const toggleTodo = (value: boolean) => {
    detallesReembolso.value.forEach((item) => {
        item.cantidadADevolver = value ? item.cantidadOriginal : 0;
    });
};

const procesarReembolso = () => {
    if (hayErrores.value) {
        $q.notify({
            message: 'Hay errores de validación. Revisa las cantidades.',
            color: 'negative',
            icon: 'error',
        });
        return;
    }

    if (!algunoSeleccionado.value) {
        $q.notify({
            message: 'Selecciona al menos un producto para devolver',
            color: 'warning',
            icon: 'warning',
        });
        return;
    }

    if (!motivo.value.trim()) {
        $q.notify({
            message: 'Escribe el motivo del reembolso',
            color: 'warning',
            icon: 'warning',
        });
        return;
    }

    // Obtener solo los productos que serán devueltos (cantidad > 0)
    const reembolsos = detallesReembolso.value.filter((item) => item.cantidadADevolver > 0);

    // Validar que las cantidades no excedan lo vendido
    const valido = reembolsos.every(
        (item) => item.cantidadADevolver <= item.cantidadOriginal && item.cantidadADevolver > 0
    );

    if (!valido) {
        $q.notify({
            message: 'Cantidades inválidas detectadas',
            color: 'negative',
            icon: 'error',
        });
        return;
    }

    // Preparar payload
    const payload: RefundPayload = {
        venta_id: ventaActual.value?.id || 0,
        motivo: motivo.value.trim(),
        reembolsos: reembolsos.map((item) => ({
            producto_id: item.producto_id,
            cantidad: item.cantidadADevolver,
            precio_unitario: item.precio_unitario,
        })),
        monto_total_reembolso: Number(montoTotalReembolso.value.toFixed(2)),
    };

    // Confirmar acción antes de procesar
    $q.dialog({
        title: 'Confirmar Reembolso',
        message: `¿Reembolsar ${reembolsos.length} producto(s) por un total de $${montoTotalReembolso.value.toFixed(2)}?`,
        persistent: true,
        ok: {
            label: 'Sí, procesar reembolso',
            color: 'positive',
            noCaps: true,
        },
        cancel: {
            label: 'Cancelar',
            color: 'grey',
            noCaps: true,
        },
    }).onOk(() => {
        void procesarReembolsoConfirmado(payload, reembolsos);
    });
};

const procesarReembolsoConfirmado = async (payload: RefundPayload, reembolsos: RefundItem[]) => {
    procesando.value = true;
    try {
        // Llamar API para procesar reembolso
        const response = await api.post('reembolsos', payload);

        if (response.status === 201 || response.status === 200) {
            $q.notify({
                message: `Reembolso procesado correctamente. ID: ${response.data?.id || 'N/A'}`,
                color: 'positive',
                icon: 'check_circle',
                position: 'top',
            });

            // Emitir evento con los datos del reembolso
            emit('refund', {
                motivo: motivo.value,
                reembolsos,
                montoTotal: Number(montoTotalReembolso.value.toFixed(2)),
            });

            cerrarModal();
        } else {
            throw new Error('Respuesta inesperada del servidor');
        }
    } catch (err) {
        console.error('Error procesando reembolso:', err);
        const msg = err instanceof Error ? err.message : 'Error al procesar el reembolso';
        $q.notify({
            message: msg,
            color: 'negative',
            icon: 'error',
            position: 'top',
        });
    } finally {
        procesando.value = false;
    }
};

// Exponer método abrirModal
defineExpose({
    abrirModal,
});
</script>

<template>
    <q-dialog v-model="show" @hide="cerrarModal" :full-width="$q.screen.xs">
        <q-card class="refund-modal" :class="{ 'full-screen-mobile': $q.screen.xs }">
            <!-- Header -->
            <q-card-section class="row items-center q-pb-none bg-orange-1">
                <div class="text-h6 text-weight-bold">
                    <q-icon name="assignment_return" color="orange-8" class="q-mr-sm" />
                    Procesar Reembolso
                </div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
            </q-card-section>

            <!-- Venta Info -->
            <q-card-section class="bg-grey-1 q-py-md">
                <div class="row items-center justify-between q-gutter-md">
                    <div>
                        <div class="text-caption text-grey-7">Venta Nro.:</div>
                        <div class="text-h6 text-weight-bold text-primary">#{{ ventaActual?.id }}</div>
                    </div>
                    <div class="col-grow">
                        <div class="text-caption text-grey-7">Cliente:</div>
                        <div class="text-weight-bold ellipsis">{{ ventaActual?.cliente || 'Cliente General' }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-grey-7">Total Original:</div>
                        <div class="text-h6 text-weight-bold">${{ Number(ventaActual?.total || 0).toFixed(2) }}</div>
                    </div>
                </div>
            </q-card-section>

            <!-- Detalles de productos -->
            <q-card-section class="q-pa-md scroll-area">
                <!-- Botón seleccionar todo / deseleccionar todo -->
                <div class="row q-mb-md items-center">
                    <div class="text-subtitle2 text-weight-bold">Productos a Devolver:</div>
                    <q-space />
                    <q-btn v-if="todosDesdeActual" flat dense size="sm" label="Seleccionar Todo" color="primary"
                        @click="toggleTodo(true)" />
                    <q-btn v-else flat dense size="sm" label="Deseleccionar Todo" color="negative"
                        @click="toggleTodo(false)" />
                </div>

                <!-- Items a devolver -->
                <div class="refund-items q-mb-md">
                    <div v-for="(item, idx) in detallesReembolso" :key="`${item.producto_id}-${idx}`"
                        class="refund-item q-pa-md bg-white rounded-borders q-mb-sm"
                        :class="{ 'selected': item.cantidadADevolver > 0 }">
                        <div class="column q-gutter-md">
                            <div>
                                <div class="text-weight-bold text-subtitle2">{{ item.nombre }}</div>
                                <div class="text-caption text-grey-6">
                                    {{
                                        item.cantidadOriginal
                                    }}
                                    {{ item.medida }} vendidas × ${{ item.precio_unitario.toFixed(2) }}
                                </div>
                            </div>

                            <div class="row items-end q-gutter-md">
                                <div class="col-grow">
                                    <div class="text-caption text-grey-7 q-mb-xs">
                                        Cantidad a devolver:
                                        <span class="text-weight-bold text-info">(Máx: {{ item.cantidadOriginal
                                            }})</span>
                                    </div>
                                    <q-input v-model.number="item.cantidadADevolver" type="number" outlined dense
                                        :min="0" :max="item.cantidadOriginal" class="full-width"
                                        :error="erroresValidacion.has(`${item.producto_id}`)" :rules="[
                                            val => val !== null && val !== undefined || 'Campo requerido',
                                            val => val >= 0 || 'No puede ser negativo',
                                            val => Number.isInteger(val) || 'Debe ser un número entero',
                                            val => val <= item.cantidadOriginal || `No puedes devolver más de ${item.cantidadOriginal}`
                                        ]" @update:model-value="(val) => {
                        const numVal = Number(val) || 0;
                        item.cantidadADevolver = Math.max(0, Math.min(numVal, item.cantidadOriginal));
                        // Validar
                        if (item.cantidadADevolver > item.cantidadOriginal || item.cantidadADevolver < 0) {
                            agregarError(item.producto_id);
                        } else {
                            removerError(item.producto_id);
                        }
                    }" @blur="() => {
                        if (item.cantidadADevolver > item.cantidadOriginal || item.cantidadADevolver < 0) {
                            agregarError(item.producto_id);
                        } else {
                            removerError(item.producto_id);
                        }
                    }" />
                                </div>
                                <div class="text-right">
                                    <div class="text-caption text-grey-7">Subtotal:</div>
                                    <div class="text-weight-bold text-primary text-h6">
                                        ${{ (item.cantidadADevolver * item.precio_unitario).toFixed(2) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Motivo del reembolso -->
                <div class="q-mb-md">
                    <q-input v-model="motivo" outlined label="Motivo del reembolso *" type="textarea" rows="3"
                        hint="Ej: Producto defectuoso, cliente cambió de idea, etc." counter maxlength="200"
                        class="full-width" />
                </div>

                <!-- Resumen -->
                <div class="bg-blue-1 q-pa-md rounded-borders">
                    <div class="row justify-between items-center q-gutter-md">
                        <div>
                            <div class="text-caption text-grey-7">Monto a Reembolsar:</div>
                            <div class="text-h5 text-weight-bold text-blue-9">
                                ${{ montoTotalReembolso.toFixed(2) }}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-caption text-grey-7">Cambio a devolver:</div>
                            <div class="text-subtitle1 text-weight-bold">
                                Efectivo / {{ ventaActual?.metodo_pago }}
                            </div>
                        </div>
                    </div>
                </div>
            </q-card-section>

            <!-- Footer con botones -->
            <q-card-section class="bg-grey-1 q-pa-md">
                <div class="row q-gutter-md justify-end">
                    <q-btn flat label="Cancelar" color="grey-7" @click="cerrarModal" />
                    <q-btn unelevated label="Procesar Reembolso" icon="assignment_return" color="orange-8"
                        :loading="procesando" :disable="!algunoSeleccionado || !motivo.trim() || hayErrores"
                        @click="procesarReembolso" />
                </div>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>

<style scoped lang="scss">
.refund-modal {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    min-width: 600px;
    max-width: 800px;

    @media (max-width: 800px) {
        min-width: auto;
        max-width: 95vw;
    }

    @media (max-width: 500px) {
        max-width: 100vw;
        border-radius: 0;
        margin: 0;
    }
}

.full-screen-mobile {
    @media (max-width: 500px) {
        width: 100vw !important;
        height: 100vh;
        max-height: 100vh;
        max-width: 100vw;
        border-radius: 0;
    }
}

.scroll-area {
    max-height: 60vh;
    overflow-y: auto;

    @media (max-height: 600px) {
        max-height: 50vh;
    }
}

.refund-items {
    .refund-item {
        border: 2px solid #f0f0f0;
        transition: all 0.3s ease;
        cursor: pointer;

        &:hover {
            border-color: #e0e0e0;
            background-color: #fafafa;
        }

        &.selected {
            border-color: #ff9800;
            background-color: #fff8f3;
        }
    }
}

.ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:deep(.q-field__error) {
    font-weight: 600;
    color: #c41e3a;
}
</style>
