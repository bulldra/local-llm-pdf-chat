import type { PdfPage } from "./pdfRenderer";

export interface PdfGroup {
  id: number;
  fileName: string;
  pages: PdfPage[];
}

export function pageKey(groupId: number, pageNumber: number): string {
  return `${groupId}:${pageNumber}`;
}
