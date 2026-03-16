<template>
  <div v-if="isVisible" class="debug-console">
    <div class="debug-header">
      <span class="debug-title">🔍 CONSOLA DEBUG</span>
      <button @click="toggleMinimize" class="debug-btn">{{ isMinimized ? '📖' : '📕' }}</button>
      <button @click="clearLogs" class="debug-btn">🗑️</button>
      <button @click="toggleVisibility" class="debug-btn">✕</button>
    </div>

    <div v-if="!isMinimized" class="debug-content">
      <div ref="logContainer" class="debug-logs">
        <div v-for="(log, idx) in logs" :key="idx" :class="['debug-log', log.type]">
          <span class="debug-time">{{ log.time }}</span>
          <span class="debug-icon">{{ log.icon }}</span>
          <span class="debug-msg" :title="String(log.msg)">{{ String(log.msg) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'

interface LogEntry {
  time: string
  type: 'log' | 'error' | 'warn' | 'info'
  icon: string
  msg: string
}

const logs = ref<LogEntry[]>([])
const isVisible = ref(true)
const isMinimized = ref(false)
const logContainer = ref<HTMLElement>()

// Guarda las funciones originales
const originalLog = console.log.bind(console)
const originalError = console.error.bind(console)
const originalWarn = console.warn.bind(console)
const originalInfo = console.info.bind(console)

const convertToString = (val: unknown): string => {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  try {
    return JSON.stringify(val)
  } catch {
    return '[Object]'
  }
}

const addLog = (msg: unknown, type: 'log' | 'error' | 'warn' | 'info') => {
  const time = new Date().toLocaleTimeString()
  const icons: Record<string, string> = {
    log: '📝',
    error: '🔴',
    warn: '⚠️',
    info: 'ℹ️',
  }

  const msgStr = convertToString(msg)

  logs.value.push({
    time,
    type,
    icon: icons[type] || '•',
    msg: msgStr.substring(0, 200), // Limitar a 200 caracteres
  })

  // Mantener solo los últimos 100 logs
  if (logs.value.length > 100) {
    logs.value.shift()
  }
}

  // Override console methods
  ; (console as unknown as { log: typeof console.log }).log = (...args: unknown[]) => {
    originalLog(...args)
    args.forEach(arg => addLog(arg, 'log'))
  }

  ; (console as unknown as { error: typeof console.error }).error = (...args: unknown[]) => {
    originalError(...args)
    args.forEach(arg => addLog(arg, 'error'))
  }

  ; (console as unknown as { warn: typeof console.warn }).warn = (...args: unknown[]) => {
    originalWarn(...args)
    args.forEach(arg => addLog(arg, 'warn'))
  }

  ; (console as unknown as { info: typeof console.info }).info = (...args: unknown[]) => {
    originalInfo(...args)
    args.forEach(arg => addLog(arg, 'info'))
  }

// Auto-scroll al final
watch(logs, async () => {
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}, { deep: true })

// Permitir toggle con Ctrl+Shift+D
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault()
      isVisible.value = !isVisible.value
    }
  }
  window.addEventListener('keydown', handleKeyDown)
})

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value
}

const toggleVisibility = () => {
  isVisible.value = false
}

const clearLogs = () => {
  logs.value = []
}
</script>

<style scoped>
.debug-console {
  position: fixed;
  bottom: 0;
  right: 0;
  width: 500px;
  height: 300px;
  background: #1e1e1e;
  border: 2px solid #00ff00;
  border-radius: 8px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #00ff00;
  margin: 10px;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
}

.debug-header {
  background: #0a0a0a;
  padding: 8px 12px;
  border-bottom: 1px solid #00ff00;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  border-radius: 6px 6px 0 0;
}

.debug-title {
  font-weight: bold;
  color: #00ff00;
}

.debug-btn {
  background: #00ff00;
  border: none;
  padding: 4px 8px;
  margin-left: 8px;
  cursor: pointer;
  border-radius: 4px;
  font-weight: bold;
  color: #000;
  transition: all 0.2s;
}

.debug-btn:hover {
  background: #00cc00;
  transform: scale(1.1);
}

.debug-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.debug-logs {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background: #1a1a1a;
}

.debug-log {
  display: flex;
  align-items: flex-start;
  margin-bottom: 4px;
  padding: 4px;
  border-radius: 3px;
  white-space: pre-wrap;
  word-break: break-word;
}

.debug-log.log {
  color: #00ff00;
}

.debug-log.error {
  color: #ff4444;
  background: rgba(255, 68, 68, 0.1);
}

.debug-log.warn {
  color: #ffaa00;
  background: rgba(255, 170, 0, 0.1);
}

.debug-log.info {
  color: #44aaff;
  background: rgba(68, 170, 255, 0.1);
}

.debug-time {
  color: #666;
  margin-right: 8px;
  min-width: 70px;
}

.debug-icon {
  margin-right: 6px;
}

.debug-msg {
  flex: 1;
}

/* Scrollbar personalizada */
.debug-logs::-webkit-scrollbar {
  width: 8px;
}

.debug-logs::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.debug-logs::-webkit-scrollbar-thumb {
  background: #00ff00;
  border-radius: 4px;
}

.debug-logs::-webkit-scrollbar-thumb:hover {
  background: #00cc00;
}
</style>
