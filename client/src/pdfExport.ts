import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DayParticipantsResponse, TopTeiler } from './types';

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return value.toFixed(1);
}

function fmtTop(top: TopTeiler | null): string {
  if (!top) return '–';
  return `${fmt(top.teiler)} (${top.firstName} ${top.lastName})`;
}

function safeFileName(input: string): string {
  return input
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/**
 * Exportiert die Rangliste des übergebenen Tages als PDF und startet den Download.
 */
export function exportRanglistePdf(
  data: DayParticipantsResponse,
  eventName?: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(eventName ? `${eventName} – Rangliste` : 'Rangliste', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(data.day.label, margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Erstellt am ${new Date().toLocaleString('de-DE')}`,
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 6;

  doc.setFontSize(10);
  doc.text(`Bester Teiler: ${fmtTop(data.stats.bestTeiler)}`, margin, y);
  y += 5;
  doc.text(
    `Zweitbester Teiler: ${fmtTop(data.stats.secondBestTeiler)}`,
    margin,
    y,
  );
  y += 5;
  doc.text(
    `Drittbester Teiler: ${fmtTop(data.stats.thirdBestTeiler)}`,
    margin,
    y,
  );
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        'Rang',
        'Name',
        'Verein',
        'Bester Teiler',
        '2. Teiler',
        'Summe',
        'Schüsse',
      ],
    ],
    body: data.participants.map((p) => [
      String(p.rank),
      `${p.firstName} ${p.lastName}`,
      p.club ?? '–',
      fmt(p.bestTeiler),
      fmt(p.secondBestTeiler),
      fmt(p.teilerSum),
      String(p.totalShots),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [5, 150, 105], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { halign: 'right', cellWidth: 14 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Seite ${doc.getNumberOfPages()}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' },
      );
      doc.setTextColor(0);
    },
  });

  const fileName = `rangliste_${safeFileName(data.day.date)}.pdf`;
  doc.save(fileName);
}
