import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfDropZone } from "./components/PdfDropZone";
import { PagePicker } from "./components/PagePicker";
import { ChatView } from "./components/ChatView";
import type { PdfPage } from "./lib/pdfRenderer";
import { fetchModels } from "./lib/lmstudioClient";
import { pageKey } from "./lib/types";
import type { PdfGroup } from "./lib/types";

const BASE_URL = "/pdf-render/lmstudio";
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 280;

export default function App() {
  const baseUrl = BASE_URL;
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [modelError, setModelError] = useState("");

  const [pdfGroups, setPdfGroups] = useState<PdfGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoPrompt, setAutoPrompt] = useState<{ text: string; id: number } | null>(null);
  const nextGroupId = useRef(0);

  // リサイズ
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + e.clientX - startX.current));
      setPanelWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const loadModels = async (url: string) => {
    setModelError("");
    try {
      const list = await fetchModels(url);
      setModels(list);
      if (list.length > 0 && !model) setModel(list[0]);
    } catch {
      setModelError("LM Studio に接続できません");
      setModels([]);
    }
  };

  useEffect(() => { loadModels(baseUrl); }, []);

  const allocateGroup = (): number => {
    const gid = nextGroupId.current++;
    setPdfGroups((prev) => [...prev, { id: gid, fileName: "", pages: [] }]);
    return gid;
  };

  const handlePage = (gid: number, page: PdfPage, current: number) => {
    setPdfGroups((prev) =>
      prev.map((g) => g.id === gid ? { ...g, pages: [...g.pages, page] } : g)
    );
    if (current <= 20) {
      setSelected((prev) => new Set([...prev, pageKey(gid, page.pageNumber)]));
    }
  };

  const handleDone = (gid: number, name: string) => {
    setPdfGroups((prev) =>
      prev.map((g) => g.id === gid ? { ...g, fileName: name } : g)
    );
    setAutoPrompt({ text: "このPDFの内容を詳しく解説してください。", id: Date.now() });
  };

  const togglePage = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const rangeToggle = (keys: string[], add: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) add ? next.add(k) : next.delete(k);
      return next;
    });

  const removeGroup = (groupId: number) => {
    setPdfGroups((prev) => prev.filter((g) => g.id !== groupId));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of prev) {
        if (key.startsWith(`${groupId}:`)) next.delete(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    for (const g of pdfGroups) {
      for (const p of g.pages) all.add(pageKey(g.id, p.pageNumber));
    }
    setSelected(all);
  };

  const selectedPages = useMemo(() =>
    pdfGroups.flatMap((g) =>
      g.pages.filter((p) => selected.has(pageKey(g.id, p.pageNumber)))
    ), [pdfGroups, selected]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#111",
      color: "#e8e8e8",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* ヘッダー */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        borderBottom: "1px solid #2a2a2a",
        background: "#161616",
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, color: "#4f8ef7" }}>PDF Vision Chat</span>
        <span style={{ color: "#444" }}>|</span>
        <span style={{ fontSize: 12, color: "#666" }}>localhost:1234</span>
        {modelError ? (
          <span style={{ color: "#f87171", fontSize: 12 }}>{modelError}</span>
        ) : (
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 4,
              color: "#ccc",
              padding: "3px 8px",
              fontSize: 12,
              maxWidth: 300,
            }}
          >
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <button
          onClick={() => loadModels(baseUrl)}
          style={{
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 4,
            color: "#888",
            padding: "3px 8px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ↺
        </button>

      </div>

      {/* メインレイアウト */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 左パネル */}
        <div style={{
          width: panelWidth,
          flexShrink: 0,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden",
        }}>
          <PdfDropZone allocateGroup={allocateGroup} onPage={handlePage} onDone={handleDone} />
          {pdfGroups.length > 0 && (
            <PagePicker
              pdfGroups={pdfGroups}
              selected={selected}
              onToggle={togglePage}
              onRangeToggle={rangeToggle}
              onRemove={removeGroup}
              onSelectAll={selectAll}
              onClear={() => setSelected(new Set())}
            />
          )}
        </div>

        {/* ドラッグハンドル */}
        <div
          onMouseDown={onMouseDown}
          style={{
            width: 5,
            flexShrink: 0,
            cursor: "col-resize",
            background: "#2a2a2a",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#4f8ef7")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#2a2a2a")}
        />

        {/* 右パネル */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ChatView baseUrl={baseUrl} model={model} selectedPages={selectedPages} autoPrompt={autoPrompt} reasoningEffort="none" />
        </div>
      </div>
    </div>
  );
}
