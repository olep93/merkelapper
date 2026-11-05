import { PDFDocument, PrintScaling } from "pdf-lib";
// Copied pages lose the source's document settings, so the A3 print request is set again.
export async function combinePdfs(files: Uint8Array[], title: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator("Jobbverktøy - Merkelapp");
  const viewerPrefs = doc.catalog.getOrCreateViewerPreferences();
  viewerPrefs.setPickTrayByPDFSize(true);
  viewerPrefs.setPrintScaling(PrintScaling.None);
  for (const file of files) {
    const source = await PDFDocument.load(file);
    const pages = await doc.copyPages(source, source.getPageIndices());
    for (const page of pages) doc.addPage(page);
  }
  return { bytes: await doc.save(), pages: doc.getPageCount() };
}
