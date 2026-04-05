import { useRef, useState } from "react";
import type { PdfPage } from "../lib/pdfRenderer";
import type { PdfGroup } from "../lib/types";
import { pageKey } from "../lib/types";

interface Props {
  pdfGroups: PdfGroup[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onRangeToggle: (keys: string[], add: boolean) => void;
  onRemove: (groupId: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

interface HoverState {
  page: PdfPage;
  x: number;
  y: number;
}

const PREVIEW_W = 500;

export function PagePicker({ pdfGroups, selected, onToggle, onRangeToggle, onRemove, onSelectAll, onClear }: Props) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const lastClicked = useRef<string | null>(null);

  const toggleCollapse = (groupId: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });

  const handleClick = (groupId: number, pageNumber: number, e: React.MouseEvent) => {
    const key = pageKey(groupId, pageNumber);
    if (e.shiftKey && lastClicked.current !== null) {
      const [lastGid, lastPage] = lastClicked.current.split(":").map(Number);
      if (lastGid === groupId) {
        const from = Math.min(lastPage, pageNumber);
        const to = Math.max(lastPage, pageNumber);
        const keys: string[] = [];
        for (let i = from; i <= to; i++) keys.push(pageKey(groupId, i));
        onRangeToggle(keys, selected.has(lastClicked.current));
      } else {
        onToggle(key);
      }
    } else {
      onToggle(key);
    }
    lastClicked.current = key;
  };

  const onMouseMove = (page: PdfPage, e: React.MouseEvent) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const previewH = Math.round(PREVIEW_W * (page.height / page.width));
    const x = e.clientX + 12 + PREVIEW_W > vw ? e.clientX - PREVIEW_W - 12 : e.clientX + 12;
    const y = Math.min(e.clientY, vh - previewH - 8);
    setHover({ page, x, y });
  };

  const totalPages = pdfGroups.reduce((s, g) => s + g.pages.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSelectAll} style={btnStyle}>全選択</button>
        <button onClick={onClear} style={btnStyle}>クリア</button>
        <span style={{ color: "#888", fontSize: 12, alignSelf: "center" }}>
          {selected.size} / {totalPages} ページ選択中
        </span>
      </div>

      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 260px)", display: "flex", flexDirection: "column", gap: 4 }}>
        {pdfGroups.map((group) => {
          const isCollapsed = collapsed.has(group.id);
          const groupSelected = group.pages.filter((p) => selected.has(pageKey(group.id, p.pageNumber))).length;
          return (
            <div key={group.id}>
              {/* アコーディオンヘッダー */}
              <div
                onClick={() => toggleCollapse(group.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: 4,
                  background: "#1a1a1a",
                  userSelect: "none",
                  fontSize: 11,
                }}
              >
                <span style={{
                  display: "inline-block",
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                  transition: "transform 0.15s",
                  color: "#888",
                  fontSize: 10,
                }}>
                  ▶
                </span>
                <span style={{ color: "#ccc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {group.fileName || "読み込み中..."}
                </span>
                <span style={{ color: "#666", flexShrink: 0 }}>
                  {groupSelected}/{group.pages.length}
                </span>
                <span
                  onClick={(e) => { e.stopPropagation(); onRemove(group.id); }}
                  style={{
                    color: "#666",
                    fontSize: 13,
                    lineHeight: 1,
                    padding: "0 2px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  title="PDFを削除"
                >
                  ×
                </span>
              </div>

              {/* ページグリッド */}
              {!isCollapsed && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: 6,
                  padding: "6px 0",
                }}>
                  {group.pages.map((p) => {
                    const key = pageKey(group.id, p.pageNumber);
                    const active = selected.has(key);
                    return (
                      <div
                        key={key}
                        onClick={(e) => handleClick(group.id, p.pageNumber, e)}
                        onMouseMove={(e) => onMouseMove(p, e)}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          cursor: "pointer",
                          border: `2px solid ${active ? "#4f8ef7" : "#333"}`,
                          borderRadius: 4,
                          position: "relative",
                          background: "#111",
                          aspectRatio: `${p.width} / ${p.height}`,
                        }}
                      >
                        <img
                          src={p.dataUrl}
                          alt={`Page ${p.pageNumber}`}
                          width={p.width}
                          height={p.height}
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                            objectFit: "contain",
                            clipPath: "inset(0 round 2px)",
                          }}
                        />
                        <div style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: active ? "#4f8ef7cc" : "#000a",
                          color: "#fff",
                          fontSize: 10,
                          textAlign: "center",
                          padding: "2px 0",
                        }}>
                          {p.pageNumber}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ホバープレビュー */}
      {hover && (
        <div style={{
          position: "fixed",
          left: hover.x,
          top: hover.y,
          width: PREVIEW_W,
          pointerEvents: "none",
          zIndex: 9999,
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: "0 8px 32px #000c",
          border: "1px solid #444",
        }}>
          <img
            src={hover.page.dataUrl}
            width={hover.page.width}
            height={hover.page.height}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 12,
  background: "#2a2a2a",
  color: "#ccc",
  border: "1px solid #444",
  borderRadius: 4,
  cursor: "pointer",
};
