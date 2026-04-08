/**
 * PDF Generation utility - completely separated from Vue reactivity
 * This ensures jsPDF works correctly without Vue Proxy interference
 */

type DetalleOrden = {
  producto_id: number | null;
  cantidad: number;
  precio_unitario: number;
  tipo?: string;
  measurements?: number[];
  rollos?: number;
};

interface PDFPayload {
  proveedor_id?: number | null;
  detalles?: DetalleOrden[];
  estado?: string;
}

interface Inventario {
  id: number;
  producto_id: number;
  bodega_id: number;
  producto?: { nombre: string };
  medida_ind?: string;
  medida_gru?: string;
  [key: string]: unknown;
}

interface Proveedor {
  id: number;
  nombre: string;
  contacto: string;
  [key: string]: unknown;
}

export async function generateOrderPDF(
  payload: PDFPayload,
  logoUrl: string,
  inventarios: Inventario[],
  proveedores: Proveedor[],
  proveedor_id?: number,
): Promise<void> {
  try {
    // Import jsPDF outside Vue context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsPDFModule = (await import('jspdf')) as any;

    // Get the constructor
    const jsPDFClass = jsPDFModule.default || jsPDFModule.jsPDF;

    // Create instance - NOT using markRaw since this is outside Vue
    const doc = new jsPDFClass();

    // Colors
    const primaryColor = [242, 169, 59];
    const secondaryColor = [80, 80, 80];

    // ============ HEADER ============
    doc.addImage(logoUrl, 'PNG', 15, 10, 50, 25);

    doc.setFontSize(24);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('Telas Emanuel', 105, 25, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('ORDEN DE COMPRA', 105, 35, { align: 'center' });

    // ============ COMPANY CONTACT INFO (Right) ============
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    const rightMargin = 195;
    doc.text('Dirección de la Empresa', rightMargin, 15, { align: 'right' });
    doc.text('Supermanzana 94, 77517', rightMargin, 20, { align: 'right' });
    doc.text('Cancún, Quintana Roo', rightMargin, 25, { align: 'right' });
    doc.text('telasemanuel23@hotmail.com', rightMargin, 30, { align: 'right' });
    doc.text('(998) 260 3290', rightMargin, 35, { align: 'right' });

    // Separator line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(15, 45, 195, 45);

    // ============ SUPPLIER INFO ============
    const currentProviderId = proveedor_id || payload.proveedor_id;
    const proveedor = proveedores.find((p) => p.id === currentProviderId);
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Proveedor:', 15, 55);

    doc.setFont('helvetica', 'normal');
    doc.text(proveedor ? proveedor.nombre : 'No encontrado', 40, 55);

    // ============ PRODUCTS TABLE ============
    let yPosition = 75;

    // Table header with color
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, yPosition, 180, 8, 'F');

    // Check which columns to show
    const mostrarCantidad = (payload.detalles ?? []).some(
      (d: DetalleOrden) => Number(d.cantidad) > 0,
    );
    const mostrarRollos = (payload.detalles ?? []).some((d: DetalleOrden) => d.tipo === 'rollos');

    const posCantidad = 110;
    let posRollos = 110;

    if (mostrarCantidad && mostrarRollos) {
      posRollos = 135;
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN DEL ARTÍCULO', 17, yPosition + 5.5);

    if (mostrarCantidad) {
      doc.text('CANTIDAD', posCantidad, yPosition + 5.5);
    }

    if (mostrarRollos) {
      doc.text('CANTIDAD', posRollos, yPosition + 5.5);
    }

    yPosition += 8;

    // Products
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    let rowIndex = 0;
    (payload.detalles ?? []).forEach((detalle: DetalleOrden) => {
      const invItem = inventarios.find((inv) => inv.producto_id === detalle.producto_id);
      if (invItem) {
        const productoNombre = invItem.producto?.nombre || 'Producto desconocido';
        const cantidadItem = detalle.cantidad;
        const rollosItem = detalle.rollos;
        const medidaInd = String(invItem.medida_ind || '');
        const medidaGru = String(invItem.medida_gru || '');

        const displayNombre = productoNombre.toUpperCase();
        /*if (detalle.tipo === 'rollos' && detalle.measurements && detalle.measurements.length > 0) {
          displayNombre += ` (${detalle.measurements.join(', ')} ${medidaInd})`;
        }*/

        const maxWidth = (mostrarCantidad ? posCantidad : posRollos) - 20;
        const lines = doc.splitTextToSize(displayNombre, maxWidth);
        const rowHeight = Math.max(10, lines.length * 5 + 2);

        // Alternating row background
        if (rowIndex % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(15, yPosition, 180, rowHeight, 'F');
        }

        // Content
        doc.setFont('helvetica', 'bold');
        lines.forEach((line: string, i: number) => {
          doc.text(line, 17, yPosition + 6 + i * 5);
        });

        doc.setFont('helvetica', 'normal');
        if (mostrarCantidad && cantidadItem > 0) {
          doc.text(`${cantidadItem} ${medidaInd}`, posCantidad + 7, yPosition + 6, {
            align: 'center',
          });
        }

        if (mostrarRollos && detalle.tipo === 'rollos') {
          doc.text(`${rollosItem} ${medidaGru}`, posRollos + 7, yPosition + 6, { align: 'center' });
        }

        yPosition += rowHeight;
        rowIndex++;
      }
    });

    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(15, yPosition + 2, 195, yPosition + 2);

    // ============ FOOTER ============
    const footerY = 265;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 0, 0);
    doc.text('Nota: enviar factura al correo telasemanuel23@hotmail.com', 105, footerY + 2, {
      align: 'center',
    });

    // Save
    doc.save(`orden_compra_${proveedor ? proveedor.nombre : 'no_proveedor'}.pdf`);
    console.log('PDF generado exitosamente');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Error al generar PDF: ${String(error)}`, { cause: error });
  }
}
