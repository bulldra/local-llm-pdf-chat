# Local LLM PDF Chat

PDF を LM Studio のビジョンモデルに渡してチャットできる Web アプリ + MCP サーバー。

## 機能

### Web UI（frontend + backend）

- PDF をドラッグ＆ドロップまたはファイル選択でアップロード
- 複数 PDF の同時読み込み・アコーディオン表示
- ページサムネイルのプログレッシブ表示（NDJSON ストリーミング）
- Shift+クリックによるページ範囲選択・範囲解除
- 選択ページを LM Studio ビジョンモデルに送信してチャット
- SSE ストリーミングによるリアルタイム応答表示
- パネルリサイズ対応

### MCP サーバー（mcp）

Claude Desktop、Claude Code、Cursor 等の MCP クライアントから PDF を画像として読み取るツール。

| ツール | 説明 |
|---|---|
| `pdf_page_count` | PDF の総ページ数を返す |
| `pdf_get_page` | 指定ページを PNG 画像として返す |
| `pdf_get_all_pages` | 全ページを PNG 画像として返す（20 ページ以下） |

## 必要条件

- Python 3.11+
- [uv](https://docs.astral.sh/uv/)（Python パッケージ管理）
- [bun](https://bun.sh/)（Node.js ランタイム / パッケージ管理）
- [LM Studio](https://lmstudio.ai/)（ビジョンモデル実行）

## セットアップ

```bash
git clone https://github.com/bulldra/local-llm-pdf-chat.git
cd local-llm-pdf-chat
uv sync
cd frontend && bun install
```

## 起動

```bash
# LM Studio を起動してビジョンモデルをロードしておく（ポート 1234）

# バックエンド + フロントエンドを一括起動
./start.sh
```

ブラウザで http://localhost:5173 を開く。

個別起動:

```bash
uv run python backend/src/render_server.py   # バックエンド（:5174）
cd frontend && bun dev                       # フロントエンド（:5173）
```

## MCP クライアントへの設定

MCP 対応クライアントの設定ファイルに以下を追加する。

```json
{
  "mcpServers": {
    "pdf-image-mcp": {
      "command": "uv",
      "args": [
        "run",
        "--project",
        "/path/to/local-llm-pdf-chat",
        "pdf-image-mcp"
      ]
    }
  }
}
```

`/path/to/local-llm-pdf-chat` はクローンしたディレクトリの絶対パスに置き換える。

MCP サーバーは backend の PDF レンダリング機能をインプロセスで呼び出すため、外部サーバーの起動は不要。

### 設定ファイルの場所

| クライアント | 設定ファイル |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code | `.mcp.json` またはグローバル設定 |
| Cursor | `.cursor/mcp.json` |
| VS Code | `.vscode/mcp.json` |

## プロジェクト構成

```
local-llm-pdf-chat/
├── backend/                 # FastAPI バックエンド
│   ├── src/                 #   PDF レンダリング + LM Studio プロキシ
│   └── tests/               #   pytest ユニットテスト
├── frontend/                # React + Vite + TypeScript UI
│   ├── src/                 #   コンポーネント + ライブラリ
│   └── tests/               #   Playwright E2E テスト
├── mcp/                     # FastMCP サーバー
│   ├── pdf_image_mcp/       #   MCP ツール定義（インターフェイスのみ）
│   └── tests/               #   pytest ユニットテスト
├── pyproject.toml           # Python 依存・ビルド・テスト設定
└── start.sh                 # 開発サーバー一括起動
```

## 技術スタック

| レイヤー | 技術 |
|---|---|
| バックエンド | FastAPI + PyMuPDF + httpx + uvicorn |
| フロントエンド | React 19 + Vite + TypeScript + react-markdown |
| MCP | FastMCP + httpx ASGITransport（インプロセス呼び出し） |
| テスト | pytest（ユニット）+ Playwright（E2E） |

## テスト

```bash
# Python ユニットテスト（backend + mcp）
uv run pytest -v

# フロントエンド E2E テスト
cd frontend && bunx playwright test
```

## ライセンス

MIT
