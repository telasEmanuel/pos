<script setup lang="ts">
import { ref } from 'vue'

const precioNuevo = ref(0)
const flete = ref(0)
const metraje = ref(0)
const porcentaje = ref(0)
const total = ref(0)

const calculo = () => {
  if (!precioNuevo.value || !flete.value || !metraje.value || !porcentaje.value) {
    alert('Por favor completa todos los campos')
    return
  }

  const IVA = (precioNuevo.value + flete.value) * 16 / 100
  const precioFlete = flete.value / metraje.value
  const precioConIVA = parseFloat(precioNuevo.value as unknown as string) + IVA
  const costoTotal = precioConIVA + precioFlete

  const porcentajeGane = costoTotal * porcentaje.value / 100
  total.value = (costoTotal + porcentajeGane) / metraje.value
}

const limpiar = () => {
  precioNuevo.value = 0
  flete.value = 0
  metraje.value = 0
  porcentaje.value = 0
  total.value = 0
}
</script>

<template>
  <div class="calculadora-container">
    <h2>Calculadora de Precios</h2>

    <form @submit.prevent="calculo" class="calculadora-form">
      <div class="input-group">
        <label for="precio">Precio rollo nuevo ($)</label>
        <input type="number" id="precio" v-model.number="precioNuevo" step="0.01" min="0">
      </div>

      <div class="input-group">
        <label for="flete">Precio flete ($)</label>
        <input type="number" id="flete" v-model.number="flete" step="0.01" min="0" placeholder="0.00">
      </div>

      <div class="input-group">
        <label for="metraje">Metraje</label>
        <input type="number" id="metraje" v-model.number="metraje" step="0.01" min="0.01" placeholder="0.00">
      </div>

      <div class="input-group">
        <label for="porcentaje">Porcentaje a ganar (%)</label>
        <input type="number" id="porcentaje" v-model.number="porcentaje" step="0.01" min="0" placeholder="0.00">
      </div>

      <div class="button-group">
        <button type="submit" class="btn-calcular">Calcular</button>
        <button type="button" @click="limpiar" class="btn-limpiar">Limpiar</button>
      </div>

      <div v-if="total > 0" class="resultado">
        <h3>Precio Final: ${{ total.toFixed(2) }}</h3>
      </div>
    </form>
  </div>
</template>

<style scoped>
.calculadora-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(60, 60, 90, 0.18);
}

.calculadora-container h2 {
  text-align: center;
  color: #2563eb;
  margin-bottom: 1.5rem;
  font-weight: 600;
}

.calculadora-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
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
  border-color: #4f8cff;
  outline: none;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
}

.button-group {
  display: flex;
  gap: 0.8rem;
  margin-top: 1rem;
}

.btn-calcular,
.btn-limpiar {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-calcular {
  background: #4f8cff;
  color: #fff;
}

.btn-calcular:hover {
  background: #2563eb;
  transform: translateY(-2px);
}

.btn-limpiar {
  background: #f3f4f6;
  color: #333;
}

.btn-limpiar:hover {
  background: #e5e7eb;
  transform: translateY(-2px);
}

.resultado {
  margin-top: 1.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, #10b981, #065f46);
  border-radius: 12px;
  text-align: center;
  animation: fadeIn 0.3s;
}

.resultado h3 {
  color: #fff;
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 480px) {
  .calculadora-container {
    margin: 1rem;
    padding: 1.5rem;
  }

  .button-group {
    flex-direction: column;
  }
}
</style>
