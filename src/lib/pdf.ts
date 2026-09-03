import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Section = {
  title: string;
  head: string[];
  rows: (string | number)[][];
};

/** Buat laporan PDF sederhana: judul, ringkasan, lalu beberapa tabel bagian. */
export function downloadReportPdf(opts: {
  filename: string;
  title: string;
  periodLabel: string;
  summary: { label: string; value: string }[];
  sections: Section[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
  const marginX = 40;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(27, 77, 62); // jade
  doc.text(opts.title, marginX, y);

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Periode: ${opts.periodLabel}`, marginX, y);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, doc.internal.pageSize.getWidth() - marginX, y, { align: "right" });

  y += 20;
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 4 },
    body: opts.summary.map((s) => [s.label, s.value]),
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 160 }, 1: { halign: "right" } },
  });

  // @ts-ignore - autoTable menambahkan properti ini di runtime
  y = doc.lastAutoTable.finalY + 24;

  for (const section of opts.sections) {
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = 48;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(27, 77, 62);
    doc.text(section.title, marginX, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [section.head],
      body: section.rows,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [27, 77, 62], textColor: 255 },
      alternateRowStyles: { fillColor: [247, 246, 243] },
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 24;
  }

  doc.save(opts.filename);
}
