// レポートPDF書き出し: html2canvasでレポートDOMを画像化 → jsPDFでA4複数ページに分割
export async function exportReportPdf(reportEl, filename) {
  const canvas = await html2canvas(reportEl, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = 210, pageH = 297, margin = 10;
  const imgW = pageW - margin * 2;
  const pxPerMm = canvas.width / imgW;
  const pageHpx = Math.floor((pageH - margin * 2) * pxPerMm);

  let y = 0;
  let first = true;
  while (y < canvas.height) {
    const sliceH = Math.min(pageHpx, canvas.height - y);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, sliceH / pxPerMm);
    first = false;
    y += sliceH;
  }
  pdf.save(filename);
}
