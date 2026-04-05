# PDF Vision Chat

PDF を LM Studio のビジョンモデルに渡してチャットできる Web アプリ。

## モノレポ構成

```
pdf-image-mcp/
├── backend/                 # FastAPI バックエンド
│   ├── src/                 #   ソースコード
│   │   ├── render_server.py #     メインサーバー（ルーター組み立て）
│   │   ├── pdf_routes.py    #     PDF レンダリング API
│   │   └── lmstudio_routes.py #   LM Studio リバースプロキシ
│   └── tests/               #   バックエンド テスト
├── frontend/                # React + Vite + TypeScript UI
│   ├── src/
│   │   ├── components/      #     PagePicker, ChatView, PdfDropZone
│   │   └── lib/             #     types, pdfRenderer, lmstudioClient
│   └── tests/               #   Playwright E2E テスト
├── mcp/                     # FastMCP サーバー（MCP ツール）
│   ├── pdf_image_mcp/       #   パッケージ（hatch ビルド対象）
│   │   └── server.py        #     MCP ツール定義（インターフェイスのみ）
│   └── tests/               #   MCP テスト
├── pyproject.toml           # Python 依存・ビルド・テスト設定
├── start.sh                 # 開発サーバー一括起動
└── .gitignore
```

### 各モジュールの責務

| モジュール | 責務 | 依存 |
|---|---|---|
| `backend/src/` | PDF レンダリング + LM Studio プロキシ | PyMuPDF, FastAPI, httpx |
| `frontend/` | UI 表示とユーザー操作 | React, Vite |
| `mcp/pdf_image_mcp/` | MCP ツールインターフェイス（PDF 処理は backend に委譲） | FastMCP, httpx, backend/src/pdf_routes |

### テスト配置

各モジュールのテストはモジュール内の `tests/` に配置する。

| テスト | 実行方法 |
|---|---|
| `backend/tests/` | `uv run pytest backend/tests/ -v` |
| `mcp/tests/` | `uv run pytest mcp/tests/ -v` |
| `frontend/tests/` | `cd frontend && bunx playwright test` |
| 全 Python テスト | `uv run pytest -v`（testpaths で自動検出） |

## ポート

| ポート | 用途 |
|---|---|
| 5173 | Vite フロントエンド |
| 5174 | Python バックエンド（FastAPI） |
| 1234 | LM Studio |

## 起動方法

```bash
./start.sh          # バックエンド＋フロントエンドを一括起動
```

または個別に:

```bash
uv run python backend/src/render_server.py   # バックエンド
cd frontend && bun dev                       # フロントエンド
```

## スキル一覧

| スキル | 内容 |
|---|---|
| `/dev` | バックエンド＋フロントエンド開発サーバー起動 |
| `/test` | pytest でユニットテストを実行 |
| `/e2e` | Playwright で E2E ユースケーステストを実行 |
| `/check` | ruff + mypy でコード品質チェック |

## 技術スタック

- **バックエンド**: FastAPI + PyMuPDF（fitz）+ httpx + uvicorn
- **フロントエンド**: React 19 + Vite + TypeScript + react-markdown
- **MCP**: FastMCP（backend の pdf_routes をインプロセス ASGI で呼び出し）
- **テスト**: Playwright（E2E）+ pytest（ユニット）
- **パッケージ管理**: uv（Python）/ bun（Node.js）

## アーキテクチャ

- PDF レンダリング: PyMuPDF → PNG → base64 → NDJSON ストリーミング
- LM Studio 接続: フロントエンド → Vite プロキシ → FastAPI → LM Studio（SSE 対応）
- 画像送信: 選択ページを base64 dataUrl として OpenAI 互換 API の `image_url` で送信
- MCP サーバー: httpx.AsyncClient + ASGITransport で backend/src/pdf_routes をインプロセス呼び出し（外部サーバー不要）
