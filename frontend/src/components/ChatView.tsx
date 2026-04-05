import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight, faPen, faStop } from "@fortawesome/free-solid-svg-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import type { ChatMessage, ContentPart, ReasoningEffort } from "../lib/lmstudioClient";
import { streamChat } from "../lib/lmstudioClient";
import type { PdfPage } from "../lib/pdfRenderer";

interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  reasoning?: string;
  pageCount?: number;
}

interface Props {
  baseUrl: string;
  model: string;
  selectedPages: PdfPage[];
  autoPrompt?: { text: string; id: number } | null;
  reasoningEffort: ReasoningEffort;
}

const REASONING_PLUGINS = [remarkGfm, remarkCjkFriendly];

const actionBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: "none",
  border: "none",
  color: disabled ? "#333" : "#555",
  cursor: disabled ? "default" : "pointer",
  fontSize: 13,
  padding: "2px 5px",
  borderRadius: 4,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
});

function ReasoningBlock({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(false);

  const preview = text
    .trimEnd()
    .split("\n")
    .filter((l) => l.trim() !== "")
    .slice(-3)
    .join("\n");

  return (
    <div style={{ marginBottom: 6 }}>
      {/* ヘッダー（クリックでトグル） */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: "pointer",
          fontSize: 12,
          color: "#555",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 4,
        }}
      >
        <span style={{
          fontSize: 10,
          display: "inline-block",
          transition: "transform 0.15s",
          transform: open ? "rotate(90deg)" : "none",
        }}>▶</span>
        <span>思考過程 {streaming ? "…" : ""}</span>
      </div>

      {/* 常に表示: 閉じているときは末尾3行、開いているときは全文 */}
      <div style={{
        paddingLeft: 10,
        borderLeft: "2px solid #333",
        fontSize: 12,
        lineHeight: 1.6,
      }}>
        <div className="md md-reasoning">
          <ReactMarkdown remarkPlugins={REASONING_PLUGINS}>
            {open ? text : preview}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export function ChatView({ baseUrl, model, selectedPages, autoPrompt, reasoningEffort }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedPagesRef = useRef(selectedPages);
  selectedPagesRef.current = selectedPages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!autoPrompt) return;
    setInput(autoPrompt.text);
  }, [autoPrompt?.id]);

  const updateLast = (updater: (m: DisplayMessage) => DisplayMessage) =>
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = updater(next[next.length - 1]);
      return next;
    });

  const cancel = () => {
    abortRef.current?.abort();
  };

  const sendMessage = async (text: string, pages: PdfPage[]) => {
    if (!text.trim() || !model) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text, pageCount: pages.length },
    ]);

    const content: ContentPart[] = pages.map((p) => ({
      type: "image_url",
      image_url: { url: p.dataUrl },
    }));
    content.push({ type: "text", text });

    const history: ChatMessage[] = [
      ...messages.map((m): ChatMessage => ({ role: m.role, content: m.text })),
      { role: "user", content },
    ];

    setMessages((prev) => [...prev, { role: "assistant", text: "", reasoning: "" }]);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      for await (const chunk of streamChat(baseUrl, model, history, { reasoningEffort, signal: abort.signal })) {
        if (chunk.type === "reasoning") {
          updateLast((m) => ({ ...m, reasoning: (m.reasoning ?? "") + chunk.text }));
        } else {
          updateLast((m) => ({ ...m, text: m.text + chunk.text }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        updateLast((m) => ({ ...m, text: `エラー: ${(e as Error).message}` }));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  };

  const send = async () => {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput("");
    await sendMessage(text, selectedPages);
  };

  const isLastAssistant = (i: number) =>
    streaming && i === messages.length - 1 && messages[i].role === "assistant";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div data-testid="scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "12px 12px 0 12px" }}>
        {messages.length === 0 && (
          <p style={{ color: "#555", textAlign: "center", marginTop: 40 }}>
            左のパネルでPDFを読み込み、ページを選択してから質問してください
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex",
            flexDirection: "column",
          }}>
            {m.role === "user" && (m.pageCount ?? 0) > 0 && (
              <span style={{ fontSize: 11, color: "#4f8ef7", marginBottom: 2, alignSelf: "flex-end" }}>
                画像 {m.pageCount} ページ添付
              </span>
            )}
            <div style={{
              maxWidth: m.role === "user" ? "70%" : undefined,
              alignSelf: m.role === "user" ? "flex-end" : undefined,
              marginRight: m.role === "assistant" ? 100 : 4,
              padding: m.role === "assistant" ? "12px 20px" : "6px 10px",
              borderRadius: 8,
              background: m.role === "user" ? "#1e3a5f" : "#2a2a2a",
              color: "#e8e8e8",
              fontSize: 14,
              wordBreak: "break-word",
            }}>
              {m.role === "assistant" && m.reasoning && (
                <ReasoningBlock text={m.reasoning} streaming={isLastAssistant(i)} />
              )}
              {m.role === "assistant" ? (
                <div className="md">
                  <ReactMarkdown remarkPlugins={REASONING_PLUGINS}>
                    {m.text + (isLastAssistant(i) ? "▋" : "")}
                  </ReactMarkdown>
                </div>
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {m.text || (isLastAssistant(i) && !m.reasoning ? "▋" : "")}
                </span>
              )}
            </div>

            {/* ユーザーメッセージのアクションボタン */}
            {m.role === "user" && (
              <div style={{ display: "flex", gap: 6, marginTop: 3, alignSelf: "flex-end" }}>
                {streaming && i === messages.length - 2 ? (
                  <button
                    onClick={cancel}
                    title="キャンセル"
                    style={{ ...actionBtnStyle(false), color: "#f87171" }}
                  >
                    <FontAwesomeIcon icon={faStop} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => !streaming && sendMessage(m.text, selectedPagesRef.current)}
                      disabled={streaming}
                      title="再実行"
                      style={actionBtnStyle(streaming)}
                    >
                      <FontAwesomeIcon icon={faRotateRight} />
                    </button>
                    <button
                      onClick={() => { setInput(m.text); }}
                      disabled={streaming}
                      title="再編集"
                      style={actionBtnStyle(streaming)}
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 12px 12px" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder={model ? "メッセージを入力 (Shift+Enter で送信)" : "モデルを選択してください"}
          disabled={streaming || !model}
          rows={3}
          style={{
            flex: 1,
            resize: "none",
            background: "#1a1a1a",
            border: "1px solid #444",
            borderRadius: 6,
            color: "#e8e8e8",
            padding: "8px 10px",
            fontSize: 14,
          }}
        />
        <button
          onClick={send}
          disabled={streaming || !model || !input.trim()}
          style={{
            padding: "0 18px",
            background: streaming || !model ? "#2a2a2a" : "#1e3a5f",
            color: streaming || !model ? "#555" : "#4f8ef7",
            border: "1px solid #444",
            borderRadius: 6,
            cursor: streaming || !model ? "default" : "pointer",
            fontSize: 14,
          }}
        >
          送信
        </button>
      </div>
    </div>
  );
}
