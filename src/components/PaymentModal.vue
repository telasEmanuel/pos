<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PaymentBreakdown } from './types';

const props = defineProps<{
  show: boolean;
  total: number;
  clientName?: string | null | undefined;
  initialComments?: string | null | undefined;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', data: { montoPagado: number; comentarios: string; metodoPago: string; pagoDetalle: PaymentBreakdown }): void;
}>();

// Estado granular del pago
const montoPesos = ref<number>(0);
const montoUSD = ref<number>(0);
const tasaCambio = ref<number>(16); // Valor por defecto
const montoTarjeta = ref<number>(0);
const montoTransferencia = ref<number>(0);
const tipoTarjeta = ref<'DEBITO' | 'CREDITO'>('DEBITO'); // Tipo de tarjeta

const comentarios = ref('');
const metodoPago = ref('EFECTIVO');

const metodos = [
  { id: 'EFECTIVO', label: 'Efectivo', icon: 'payments' },
  { id: 'TARJETA', label: 'Tarjeta', icon: 'credit_card' },
  { id: 'TRANSFERENCIA', label: 'Transferencia', icon: 'sync_alt' },
  { id: 'MIXTO', label: 'Mixto', icon: 'account_balance_wallet' }
];

// Sincronizar estado local cuando se abre el modal
watch(() => props.show, (val) => {
  if (val) {
    resetState();
    comentarios.value = props.initialComments || '';
    switch (metodoPago.value) {
      case 'EFECTIVO':
        montoPesos.value = props.total;
        break;
      case 'TARJETA':
        montoTarjeta.value = props.total;
        break;
      case 'TRANSFERENCIA':
        montoTransferencia.value = props.total;
        break;
      /*case 'MIXTO':
        montoPesos.value = props.total;
        break;*/
    }
    /*if (metodoPago.value === 'EFECTIVO') {
      montoPesos.value = props.total;
    } else if (metodoPago.value === 'TARJETA') {
      montoTarjeta.value = props.total;
    } else if (metodoPago.value === 'TRANSFERENCIA') {
      montoTransferencia.value = props.total;
    }*/
  }
});

const resetState = () => {
  montoPesos.value = 0;
  montoUSD.value = 0;
  montoTarjeta.value = 0;
  montoTransferencia.value = 0;
};

// Si cambia el método de pago simple, asignamos el total al campo correspondiente
watch(metodoPago, (nuevoMetodo) => {
  resetState();
  if (nuevoMetodo === 'EFECTIVO') montoPesos.value = props.total;
  if (nuevoMetodo === 'TARJETA') montoTarjeta.value = props.total;
  if (nuevoMetodo === 'TRANSFERENCIA') montoTransferencia.value = props.total;
});

const totalUSDEnPesos = computed(() => +(montoUSD.value * tasaCambio.value).toFixed(2));

const totalPagado = computed(() => {
  return +(
    montoPesos.value +
    totalUSDEnPesos.value +
    montoTarjeta.value +
    montoTransferencia.value
  ).toFixed(2);
});

const faltante = computed(() => {
  const diff = props.total - totalPagado.value;
  return diff > 0 ? +diff.toFixed(2) : 0;
});

const cambio = computed(() => {
  const diff = totalPagado.value - props.total;
  return diff > 0 ? +diff.toFixed(2) : 0;
});

const canConfirm = computed(() => totalPagado.value >= props.total);

// Funciones para asignar el resto automáticamente
const asignarResto = (campo: 'pesos' | 'usd' | 'tarjeta' | 'transferencia') => {
  const r = faltante.value;
  if (r <= 0) return;

  if (campo === 'pesos') montoPesos.value = +(montoPesos.value + r).toFixed(2);
  if (campo === 'tarjeta') montoTarjeta.value = +(montoTarjeta.value + r).toFixed(2);
  if (campo === 'transferencia') montoTransferencia.value = +(montoTransferencia.value + r).toFixed(2);
  if (campo === 'usd') {
    const usdNeeded = r / tasaCambio.value;
    montoUSD.value = +(montoUSD.value + usdNeeded).toFixed(2);
  }
};

const handleConfirm = () => {
  if (!canConfirm.value) return;

  const pagoDetalle: PaymentBreakdown = {
    efectivo: Number(montoPesos.value || 0),
    tarjeta: Number(montoTarjeta.value || 0),
    transferencia: Number(montoTransferencia.value || 0),
    dolares: Number(montoUSD.value || 0),
    tasaCambio: Number(tasaCambio.value || 0),
    totalPagado: Number(totalPagado.value || 0),
  };

  // Si se pagó con tarjeta, agregar el tipo en los comentarios
  let comentariosFinal = comentarios.value.trim();
  if ((metodoPago.value === 'TARJETA' || metodoPago.value === 'MIXTO') && montoTarjeta.value > 0) {
    const tipoInfo = `[Tipo Tarjeta: ${tipoTarjeta.value}]`;
    comentariosFinal = comentariosFinal ? `${tipoInfo} ${comentariosFinal}` : tipoInfo;
  }

  emit('confirm', {
    montoPagado: totalPagado.value,
    comentarios: comentariosFinal,
    metodoPago: metodoPago.value,
    pagoDetalle,
  });
};
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <div class="header-main">
            <h3>Procesar pago</h3>
            <div class="client-badge" v-if="clientName">{{ clientName }}</div>
          </div>
          <button class="modal-close" @click="emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <!-- Resumen de Totales -->
          <div class="summary-card">
            <div class="total-big">
              <span class="label">Total Pedido</span>
              <span class="value">${{ total.toFixed(2) }}</span>
            </div>
            <div class="balance-container">
              <div class="balance-box" :class="{ 'has-faltante': faltante > 0 }">
                <span class="label">Faltante</span>
                <span class="value">${{ faltante.toFixed(2) }}</span>
              </div>
              <div class="balance-box" :class="{ 'has-cambio': cambio > 0 }">
                <span class="label">Cambio</span>
                <span class="value">${{ cambio.toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <!-- Selección de Método Principal -->
          <div class="method-selector">
            <button v-for="m in metodos" :key="m.id" class="method-tab" :class="{ active: metodoPago === m.id }"
              @click="metodoPago = m.id">
              <span class="method-icon material-icons">{{ m.icon }}</span>
              <span class="method-text">{{ m.label }}</span>
            </button>
          </div>

          <!-- Campos de Entrada -->
          <div class="payment-fields">
            <!-- Efectivo Pesos -->
            <div class="field-group" v-if="metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO'">
              <div class="field-header">
                <label>Efectivo (Pesos)</label>
                <button v-if="metodoPago === 'MIXTO' && faltante > 0" @click="asignarResto('pesos')" class="btn-quick">
                  Completar
                </button>
              </div>
              <div class="field-input">
                <span class="prefix">$</span>
                <input type="number" v-model.number="montoPesos" step="any" min="0" />
              </div>
            </div>

            <!-- Efectivo Dólares -->
            <div class="field-group usd-group" v-if="metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO'">
              <div class="field-header">
                <label>Dólares (USD)</label>
                <div class="rate-info">
                  <span>Tasa: $</span>
                  <input type="number" v-model.number="tasaCambio" step="0.5" class="rate-input" />
                </div>
              </div>
              <div class="field-row">
                <div class="field-input usd-input">
                  <span class="prefix">U$D</span>
                  <input type="number" v-model.number="montoUSD" step="any" min="0" />
                </div>
                <div class="usd-equivalence">= ${{ totalUSDEnPesos }}</div>
              </div>
            </div>

            <!-- Tarjeta -->
            <div class="field-group" v-if="metodoPago === 'TARJETA' || metodoPago === 'MIXTO'">
              <div class="field-header">
                <label>Tarjeta</label>
                <button v-if="metodoPago === 'MIXTO' && faltante > 0" @click="asignarResto('tarjeta')"
                  class="btn-quick">
                  Completar
                </button>
              </div>
              <div class="field-input">
                <span class="prefix">💳</span>
                <input type="number" v-model.number="montoTarjeta" step="any" min="0" />
              </div>

              <!-- Botones de tipo de tarjeta -->
              <div class="card-type-buttons">
                <button type="button" class="card-type-btn" :class="{ 'active': tipoTarjeta === 'DEBITO' }"
                  @click="tipoTarjeta = 'DEBITO'">
                  💳 Tarjeta de Débito
                </button>
                <button type="button" class="card-type-btn" :class="{ 'active': tipoTarjeta === 'CREDITO' }"
                  @click="tipoTarjeta = 'CREDITO'">
                  💎 Tarjeta de Crédito
                </button>
              </div>
            </div>

            <!-- Transferencia -->
            <div class="field-group" v-if="metodoPago === 'TRANSFERENCIA' || metodoPago === 'MIXTO'">
              <div class="field-header">
                <label>Transferencia</label>
                <button v-if="metodoPago === 'MIXTO' && faltante > 0" @click="asignarResto('transferencia')"
                  class="btn-quick">
                  Completar
                </button>
              </div>
              <div class="field-input">
                <span class="prefix">📲</span>
                <input type="number" v-model.number="montoTransferencia" step="any" min="0" />
              </div>
            </div>
          </div>

          <div class="comments-box">
            <label>Notas adicionales</label>
            <textarea v-model="comentarios" placeholder="Ej: Pago con billetes de $2000..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="emit('close')">Cancelar</button>
          <button class="btn-confirm" @click="handleConfirm" :disabled="!canConfirm">
            <span class="material-icons">check_circle</span>
            Confirmar Pago (${{ totalPagado }})
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 32, 44, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.modal-content {
  background: #fdfdfd;
  border-radius: 24px;
  width: 100%;
  max-width: 500px;
  max-height: 95vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid #edf2f7;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #d9a441 0%, #8b5e3c 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.header-main h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.client-badge {
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  align-self: flex-start;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Summary Card */
.summary-card {
  background: #1a202c;
  border-radius: 16px;
  padding: 1.25rem;
  color: white;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.total-big {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.total-big .label {
  font-size: 0.9rem;
  opacity: 0.8;
}

.total-big .value {
  font-size: 2rem;
  font-weight: 800;
  color: #ffd54f;
}

.balance-container {
  display: flex;
  gap: 0.75rem;
}

.balance-box {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.balance-box .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
}

.balance-box .value {
  font-weight: 700;
  font-size: 1.1rem;
}

.has-faltante .value {
  color: #fc8181;
}

.has-cambio .value {
  color: #68d391;
}

/* Method Selector */
.method-selector {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  background: #f7fafc;
  padding: 0.4rem;
  border-radius: 14px;
}

.method-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.6rem;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  color: #718096;
}

.method-tab.active {
  background: white;
  color: #8b5e3c;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.method-icon {
  font-size: 1.25rem;
}

.method-text {
  font-size: 0.65rem;
  font-weight: 700;
}

/* Fields */
.payment-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-group {
  background: white;
  border: 1px solid #edf2f7;
  padding: 1rem;
  border-radius: 14px;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.field-header label {
  font-weight: 700;
  color: #4a5568;
  font-size: 0.85rem;
}

.btn-quick {
  font-size: 0.7rem;
  padding: 0.25rem 0.6rem;
  background: #e2e8f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.field-input {
  position: relative;
  display: flex;
  align-items: center;
}

.field-input .prefix {
  position: absolute;
  left: 0.75rem;
  font-weight: 800;
  color: #a0aec0;
}

.field-input input {
  width: 100%;
  padding: 0.6rem 0.75rem 0.6rem 2.5rem;
  border: 2px solid #f1f5f9;
  border-radius: 10px;
  font-size: 1.25rem;
  font-weight: 700;
  outline: none;
  transition: border-color 0.2s;
}

.field-input input:focus {
  border-color: #ffd54f;
}

.card-type-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.card-type-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  background: white;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.card-type-btn:hover {
  border-color: #cbd5e0;
  background: #f7fafc;
}

.card-type-btn.active {
  border-color: #d9a441;
  background: linear-gradient(135deg, rgba(217, 164, 65, 0.15) 0%, rgba(139, 94, 60, 0.1) 100%);
  color: #8b5e3c;
  font-weight: 700;
}

.usd-group {
  border-color: #ebf8ff;
  background: #f0f9ff;
}

.rate-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #4299e1;
}

.rate-input {
  width: 45px;
  border: 1px solid #bee3f8;
  border-radius: 4px;
  padding: 0.1rem;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.usd-input {
  flex: 1;
}

.usd-equivalence {
  font-size: 0.85rem;
  font-weight: 600;
  color: #2b6cb0;
}

.comments-box {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.comments-box label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #718096;
}

.comments-box textarea {
  width: 100%;
  height: 60px;
  border: 1px solid #edf2f7;
  border-radius: 12px;
  padding: 0.75rem;
  resize: none;
  font-size: 0.9rem;
}

/* Footer */
.modal-footer {
  padding: 1.25rem 1.5rem;
  background: #f8fafc;
  display: flex;
  gap: 0.75rem;
}

.btn-cancel {
  padding: 0.75rem 1.25rem;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
}

.btn-confirm {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: linear-gradient(135deg, #d9a441 0%, #8b5e3c 100%);
  color: white;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: opacity 0.2s;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
