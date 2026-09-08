/**
 * Client-side export helpers (jsPDF + papaparse).
 */

/** Convert an object/array to a downloadable CSV blob. */
export function downloadCSV(
  filename: string,
  rows: Array<Record<string, unknown>>,
): void {
  // Lazy import keeps the bundle smaller until needed.
  import("papaparse").then(({ default: Papa }) => {
    const csv = Papa.unparse(rows);
    triggerDownload(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      filename,
    );
  });
}

/** Trigger a browser download for a Blob. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Let browsers consume the URL before revoking it (notably Safari).
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export arbitrary data as JSON. */
export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, filename);
}

/**
 * Generate a simple client-side PDF (jsPDF) for quick dashboard exports.
 * Note: full reports use the backend ReportLab pipeline; this is a fallback.
 */
export async function downloadSimplePDF(
  filename: string,
  title: string,
  lines: string[],
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  let y = 32;
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line.slice(0, 100), 14, y);
    y += 6;
  }
  doc.save(filename);
}
