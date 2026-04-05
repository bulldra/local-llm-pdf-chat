# pdf-image-mcp

PDFファイルのページを画像に変換してLLMに返すMCPサーバー。

## 機能

| ツール | 説明 |
|---|---|
| `pdf_page_count` | PDFの総ページ数を返す |
| `pdf_get_page` | 指定ページを画像として返す |
| `pdf_get_all_pages` | 全ページを画像として返す（20ページ以下のみ） |

## 必要条件

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) パッケージマネージャー

## セットアップ

```bash
git clone <repository>
cd pdf-image-mcp
uv sync
```

## MCPクライアントへの設定

MCPに対応したクライアント（Claude Desktop、Claude Code、Cursor、VS Code 等）の設定ファイルに以下を追加する。

### 起動コマンド

```json
{
  "mcpServers": {
    "pdf-image-mcp": {
      "command": "uv",
      "args": [
        "run",
        "--project",
        "/path/to/pdf-image-mcp",
        "pdf-image-mcp"
      ]
    }
  }
}
```

`/path/to/pdf-image-mcp` はクローンしたディレクトリの絶対パスに置き換える。

### 各クライアントの設定ファイルの場所

| クライアント | 設定ファイル |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code | プロジェクトの `.mcp.json` またはグローバル設定 |
| Cursor | `.cursor/mcp.json` |
| VS Code | `.vscode/mcp.json` |
| LM Studio (macOS/Linux) | `~/.lmstudio/mcp.json` |
| LM Studio (Windows) | `%USERPROFILE%\.lmstudio\mcp.json` |
| その他MCPクライアント | 各クライアントのドキュメントを参照 |

設定後、クライアントを再起動する。

LM Studio では UI から編集することもできる：**Program タブ → Install → Edit mcp.json**

## LM Studio での使い方

> **注意**: LM Studio の「ファイル添付」機能は PDF のテキストを抽出してLLMに渡す。このMCPサーバーはファイルパスを受け取って画像を生成するため、添付機能とは別に動作する。

ファイルを添付するのではなく、チャットにファイルの絶対パスを直接書いて指示する：

```
/Users/yourname/Documents/report.pdf の1ページ目を画像で見せて
```

```
/Users/yourname/Documents/report.pdf は何ページある？
```

```
/Users/yourname/Documents/slides.pdf の全ページを画像で表示して
```

LLMがMCPツールを呼び出す前に確認ダイアログが表示されるので、引数を確認して承認する。

## 使い方

LLMに対して以下のように指示する：

```
/path/to/document.pdf の1ページ目を見せて
```

```
/path/to/document.pdf は何ページある？
```

```
/path/to/document.pdf の全ページを画像で表示して
```

## ツール詳細

### `pdf_page_count`

```
引数:
  pdf_path: str  # PDFファイルの絶対パス
戻り値: ページ数（文字列）
```

### `pdf_get_page`

```
引数:
  pdf_path: str       # PDFファイルの絶対パス
  page_number: int    # ページ番号（1始まり）
  dpi: int = 150      # 解像度（72〜300）
戻り値: PNG画像
```

### `pdf_get_all_pages`

```
引数:
  pdf_path: str    # PDFファイルの絶対パス
  dpi: int = 150   # 解像度（72〜300）
戻り値: 各ページのPNG画像（20ページ以下のみ）
```

## 開発・動作確認

```bash
# インポート確認
uv run python -c "from pdf_image_mcp.server import mcp; print(mcp.name)"

# MCPインスペクターで動作確認
uv run fastmcp dev src/pdf_image_mcp/server.py
```
