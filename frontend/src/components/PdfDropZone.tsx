import { useCallback, useRef, useState } from "react";
import { renderPdf } from "../lib/pdfRenderer";
import type { PdfPage } from "../lib/pdfRenderer";

interface Props {
  allocateGroup: () => number;
  onPage: (groupId: number, page: PdfPage, current: number) => void;
  onDone: (groupId: number, fileName: string) => void;
}

export function PdfDropZone({ allocateGroup, onPage, onDone }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) return;
      const gid = allocateGroup();
      setLoading((n) => n + 1);
      try {
        await renderPdf(file, (page, current) => {
          onPage(gid, page, current);
        });
        onDone(gid, file.name);
      } finally {
        setLoading((n) => n - 1);
      }
    },
    [allocateGroup, onPage, onDone]
  );

  const handleFiles = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((f) => handleFile(f));
    },
    [handleFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => loading === 0 && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "#4f8ef7" : "#555"}`,
        borderRadius: 8,
        padding: "20px 16px",
        textAlign: "center",
        cursor: loading > 0 ? "default" : "pointer",
        background: dragging ? "#1a2a3a" : "#1a1a1a",
        transition: "all 0.15s",
        userSelect: "none",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {loading > 0 ? (
        <p style={{ color: "#888", margin: 0 }}>
          {loading} 件レンダリング中...
        </p>
      ) : (
        <>
          <p style={{ color: "#ccc", margin: 0 }}>PDFをドラッグ＆ドロップ</p>
          <p style={{ color: "#666", fontSize: 12, marginTop: 8 }}>またはクリックして選択（複数可）</p>
        </>
      )}
    </div>
  );
}
