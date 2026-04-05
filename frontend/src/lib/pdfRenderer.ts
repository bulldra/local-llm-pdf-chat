export interface PdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export async function renderPdf(
  file: File,
  onPage: (page: PdfPage, current: number, total: number) => void,
  dpi = 150,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  form.append("dpi", String(dpi));

  const res = await fetch("/pdf-render/render-pdf", { method: "POST", body: form });
  if (!res.ok) throw new Error(`PDF render error: ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let total = 0;
  let current = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line);
      if ("total" in obj) {
        total = obj.total;
      } else {
        current++;
        onPage(obj as PdfPage, current, total);
      }
    }
  }
}
