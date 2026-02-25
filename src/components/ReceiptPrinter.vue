<script setup lang="ts">
import type { ReceiptData } from './types'

const props = defineProps<{
  data: ReceiptData | null
}>()

const storeInfo = {
  name: 'TELAS EMANUEL',
  address1: 'AV. JOSÉ LÓPEZ PORTILLO SM 94',
  address2: 'MZA 101, LT 11, CANCUN, Q. ROO',
  address3: 'C.P. 77517 RFC LOGS851027BL5',
  branchName: '',
  branchLocation: '',
  branchAddress1: '',
  branchAddress2: '',
  branchAddress3: '',
  phone: 'Tel: 998 702 2579'
}

const formatAmountInLetters = (amount: number) => {
  const format = (n: number): string => {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];

    if (n === 0) return 'CERO';
    if (n < 10) return unidades[n] || '';
    if (n < 20) {
      if (n === 10) return 'DIEZ';
      return especiales[n - 11] || '';
    }
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      if (u === 0) return decenas[d - 1] || '';
      if (d === 2) return `VEINTI${unidades[u]}`;
      return `${decenas[d - 1]} Y ${unidades[u]}`;
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const resto = n % 100;
      if (n === 100) return 'CIEN';
      const prefijo = c === 1 ? 'CIENTO' : c === 5 ? 'QUINIENTOS' : c === 7 ? 'SETECIENTOS' : c === 9 ? 'NOVECIENTOS' : unidades[c] + 'CIENTOS';
      return resto === 0 ? prefijo : `${prefijo} ${format(resto)}`;
    }
    if (n < 1000000) {
      const k = Math.floor(n / 1000);
      const resto = n % 1000;
      let prefijo = '';
      if (k === 1) prefijo = 'MIL';
      else prefijo = `${format(k)} MIL`;
      return resto === 0 ? prefijo : `${prefijo} ${format(resto)}`;
    }
    return n.toString();
  };

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);
  const letters = format(integerPart);

  return `*** ${letters} PESOS ${decimalPart.toString().padStart(2, '0')}/100 M.N. ***`;
}

const formatReceiptDate = (rawDate: string) => {
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) return rawDate

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

const toMoney = (value: number) => `$${Number(value || 0).toFixed(2)}`
const formatQty = (value: number) => {
  const n = Number(value || 0)
  return Number.isInteger(n) ? n.toFixed(2) : n.toFixed(2) // Aligned with the image "1.00"
}

const escapeHTML = (text: string) => text
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const formatCommentsHTML = (comments?: string) => {
  const text = (comments ?? '')
    .replace(/^\[Detalle Pago:[^\]]*\]\s*/i, '')
    .trim()

  if (!text) return ''

  return `<div><b>Comentarios:</b></div><div>${escapeHTML(text)}</div>`
}

const paymentLinesHTML = (data: ReceiptData) => {
  const detail = data.pagoDetalle

  if (!detail) {
    return `<div>Pagó con: ${toMoney(data.total + (data.cambio ?? 0))}</div>`
  }

  if (data.metodoPago === 'TARJETA') {
    const amount = detail.tarjeta > 0 ? detail.tarjeta : detail.totalPagado
    return `<div>Pago con tarjeta: ${toMoney(amount)}</div>`
  }

  if (data.metodoPago === 'TRANSFERENCIA') {
    const amount = detail.transferencia > 0 ? detail.transferencia : detail.totalPagado
    return `<div>Pago con transferencia: ${toMoney(amount)}</div>`
  }

  if (data.metodoPago === 'MIXTO') {
    const lines: string[] = ['<div><b>Desglose de pago:</b></div>']

    if (detail.efectivo > 0) lines.push(`<div>Efectivo: ${toMoney(detail.efectivo)}</div>`)
    if (detail.tarjeta > 0) lines.push(`<div>Tarjeta: ${toMoney(detail.tarjeta)}</div>`)
    if (detail.transferencia > 0) lines.push(`<div>Transferencia: ${toMoney(detail.transferencia)}</div>`)
    if (detail.dolares > 0) {
      lines.push(`<div>Dólares: ${toMoney(detail.dolares * detail.tasaCambio)} (${detail.dolares.toFixed(2)} USD)</div>`)
    }

    return lines.join('')
  }

  const efectivo = detail.efectivo + (detail.dolares * detail.tasaCambio)
  return `<div>Efectivo: ${toMoney(efectivo > 0 ? efectivo : detail.totalPagado)}</div>`
}

const generateReceiptHTML = (data: ReceiptData) => {
  const products = data.productos.map(p => `
    <tr class="product-name-row">
      <td colspan="4"><b>${escapeHTML(p.nombre)}</b></td>
    </tr>
    <tr class="product-data-row">
      <td>${formatQty(p.cantidad)}</td>
      <td>${escapeHTML(p.medida ?? '')}</td>
      <td class="col-right">${Number(p.precio_unitario || 0).toFixed(4)}</td>
      <td class="col-right">${toMoney(p.precio_unitario * p.cantidad)}</td>
    </tr>
  `).join('')

  return `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        html, body {
          width: 58mm;
          margin: 0;
          padding: 0;
          color: #000 !important;
        }
        @page {
          size: 58mm auto;
          margin: 0;
        }
        body {
          font-family: monospace;
          font-size: 11px;
          max-width: 58mm;
          overflow: hidden;
          line-height: 1.2;
          color: #000 !important;
          -webkit-print-color-adjust: exact;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .line { border-top: 1.5px dashed #000; margin: 4px 0; }
        .double-line { border-top: 1.5px double #000; margin: 4px 0; }

        .header-section { margin-bottom: 8px; }
        .header-title { font-size: 14px; font-weight: 900; }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          color: #000 !important;
        }
        th {
          text-align: left;
          font-weight: 900;
          border-bottom: 2px double #000;
          padding: 2px 0;
        }
        td { padding: 1px 0; vertical-align: top; font-weight: 700; }
        .col-right { text-align: right; }

        .totals-table td { padding: 1px 0; font-weight: 900; }
        .totals-label { text-align: right; padding-right: 8px; font-weight: 900; }

        .footer { margin-top: 10px; font-size: 10px; font-weight: 700; }
        .barcode { margin: 8px auto; width: 80%; border-top: 15px solid #000; }

        /* Force boldness for thermal printers */
        b, strong { font-weight: 900 !important; }
      </style>
    </head>

    <body>
      <div class="header-section center">
        <div class="header-title">${storeInfo.name}</div>
        <div style="font-weight: 700;">${storeInfo.address1}</div>
        <div style="font-weight: 700;">${storeInfo.address2}</div>
        <div style="font-weight: 700;">${storeInfo.address3}</div>
        <div style="font-weight: 700;">${storeInfo.phone}</div>
        <br/>
      </div>

      <div class="line"></div>

      <div style="font-weight: 700;">Fecha: ${formatReceiptDate(data.fecha)}</div>
      <div style="font-weight: 700;">Ticket: <b>${data.ticketId || '000000'}</b></div>
      <div style="font-weight: 700;">Método de Pago: ${escapeHTML(data.metodoPago || 'NO ESPECIFICADO')}</div>
      <div style="font-weight: 700;">Cliente: ${escapeHTML(data.cliente || 'PÚBLICO EN GENERAL')}</div>

      <div class="double-line"></div>
      <div style="font-weight:900; font-size: 12px;">DESCRIPCIÓN</div>
      <table>
        <colgroup>
          <col style="width: 20%" />
          <col style="width: 20%" />
          <col style="width: 30%" />
          <col style="width: 30%" />
        </colgroup>
        <thead>
          <tr>
            <th>CANT</th>
            <th>UNI</th>
            <th class="col-right">PRECIO U.</th>
            <th class="col-right">IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          ${products}
        </tbody>
      </table>

      <div class="double-line"></div>

      <table class="totals-table">
        <colgroup>
          <col style="width: 60%" />
          <col style="width: 40%" />
        </colgroup>
        <tbody>
          <tr>
            <td class="totals-label">SubTotal:</td>
            <td class="col-right">${toMoney(data.subtotal || data.total)}</td>
          </tr>
          <tr>
            <td class="totals-label">Descuento:</td>
            <td class="col-right">${toMoney(data.descuento || 0)}</td>
          </tr>
          <tr>
            <td class="totals-label">I.V.A:</td>
            <td class="col-right">${toMoney(data.iva || 0)}</td>
          </tr>
          <tr style="font-weight:bold">
            <td class="totals-label">TOTAL:</td>
            <td class="col-right">${toMoney(data.total)}</td>
          </tr>
        </tbody>
      </table>

      <br/>
      <div class="center">${formatAmountInLetters(data.total)}</div>

      <div class="footer">
        <div>Le atendió: ${escapeHTML(data.atendidoPor || 'MOSTRADOR')}</div>
        <br/>
        <div class="center">
          ${paymentLinesHTML(data)}
          ${formatCommentsHTML(data.comentarios)}
          <br/>
          <!--<div>El ticket pertenece a factura diaria</div>
          <div>No Es un Comprobante Fiscal</div>-->
          <div>Este ticket no es un comprobante fiscal</div>
          <div>=== Gracias por su preferencia ===</div>
          <!--<div class="barcode"></div>
          <div>${data.ticketId || '0'}</div>-->
        </div>
      </div>
      <br><br>
    </body>
  </html>
  `
}

const printReceiptWindow = async () => {
  if (!props.data) return

  const html = generateReceiptHTML(props.data)

  try {
    // Detectar si estamos en Electron o navegador
    const isElectron = typeof window !== 'undefined' && (window.electron !== undefined || window.pos?.printTicket !== undefined)

    if (isElectron && window.pos?.printTicket) {
      // Estamos en Electron - usar API nativa
      await window.pos.printTicket(html)
      console.log('✅ Ticket enviado a impresora (Electron)')
    } else {
      // Estamos en navegador - imprimir en ventana nueva
      console.log('📄 Imprimiendo en navegador (fallback)')
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.print()
        console.log('✅ Ventana de impresión abierta')
      }
    }
  } catch (error) {
    console.error('❌ Error imprimiendo:', error)
    // Fallback a ventana si falla
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const generatedHtml = props.data ? generateReceiptHTML(props.data) : ''
      printWindow.document.write(generatedHtml)
      printWindow.document.close()
      printWindow.print()
    }
  }
}

defineExpose({
  getHTML: () => props.data ? generateReceiptHTML(props.data) : null,
  print: printReceiptWindow
})
</script>

<template>
  <div style="display:none"></div>
</template>
