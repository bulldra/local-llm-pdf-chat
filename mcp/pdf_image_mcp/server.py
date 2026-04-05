import asyncio
import base64
import os
import sys
from pathlib import Path
from typing import TypeAlias

import httpx
from fastapi import FastAPI
from fastmcp import FastMCP
from fastmcp.utilities.types import Image
from mcp.types import TextContent, ImageContent, EmbeddedResource, BlobResourceContents

# backend/src を import パスに追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend" / "src"))
from pdf_routes import router as pdf_router  # noqa: E402

MAX_PAGES_ALL = 20

PageContent: TypeAlias = list[TextContent | ImageContent | EmbeddedResource]

# pdf_routes のみを持つインプロセス ASGI アプリ
_pdf_app = FastAPI()
_pdf_app.include_router(pdf_router)

mcp = FastMCP(
    "pdf-image-mcp",
    instructions=(
        "This server converts PDF pages into images and returns them for visual analysis. "
        "Use it whenever the user wants to read, view, or analyze the contents of a PDF file. "
        "\n\n"
        "IMPORTANT — how to supply the file path:\n"
        "  - Always pass pdf_path as an absolute file system path (e.g. /Users/alice/docs/report.pdf).\n"
        "  - Never use relative paths, URLs, or attachment handles.\n"
        "  - If the user provides only a filename, ask for the full absolute path before calling any tool.\n"
        "\n"
        "Recommended workflow:\n"
        f"  1. Call pdf_page_count to learn the total number of pages.\n"
        f"  2. If the PDF has {MAX_PAGES_ALL} pages or fewer, call pdf_get_all_pages to retrieve all pages at once.\n"
        f"  3. If the PDF has more than {MAX_PAGES_ALL} pages, call pdf_get_page repeatedly for the pages you need.\n"
        "\n"
        "Return value structure (per page):\n"
        "  [0] TextContent  — label string e.g. 'Page 1'\n"
        "  [1] ImageContent — PNG image (mimeType: image/png, data: base64) for vision-capable clients\n"
        "  [2] EmbeddedResource — BlobResourceContents (mimeType: image/png, blob: base64) for binary-aware clients\n"
        "\n"
        "DPI guidance:\n"
        "  - 150 dpi (default): good balance of readability and response size. Suitable for most use cases.\n"
        "  - 72 dpi: smaller images, use when token budget is tight or only layout matters.\n"
        "  - 300 dpi: high fidelity, use for small-print text, charts, or fine diagrams.\n"
        "  - Always stay within the 72–300 range."
    ),
)


def _validate_path(pdf_path: str) -> None:
    if not os.path.isabs(pdf_path):
        raise ValueError("pdf_path must be an absolute path")
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"File not found: {pdf_path}")
    if not pdf_path.lower().endswith(".pdf"):
        raise ValueError("File must have a .pdf extension")


def _to_blob_resource(png_bytes: bytes, page_number: int) -> EmbeddedResource:
    return EmbeddedResource(
        type="resource",
        resource=BlobResourceContents(
            uri=f"pdf-image://page/{page_number}",  # type: ignore[arg-type]
            mimeType="image/png",
            blob=base64.b64encode(png_bytes).decode(),
        ),
    )


async def _call_pdf_api_async(endpoint: str, pdf_path: str, **data: str | int) -> dict:
    """pdf_routes の ASGI アプリにインプロセスでリクエストを送る"""
    transport = httpx.ASGITransport(app=_pdf_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://mcp-internal") as client:
        with open(pdf_path, "rb") as f:
            resp = await client.post(
                endpoint,
                files={"file": (os.path.basename(pdf_path), f, "application/pdf")},
                data={k: str(v) for k, v in data.items()},
                timeout=300,
            )
    resp.raise_for_status()
    return resp.json()


def _call_pdf_api(endpoint: str, pdf_path: str, **data: str | int) -> dict:
    return asyncio.run(_call_pdf_api_async(endpoint, pdf_path, **data))


@mcp.tool
def pdf_page_count(pdf_path: str) -> str:
    """Return the total number of pages in a PDF file.

    Call this first before rendering pages to decide whether to use
    pdf_get_all_pages or pdf_get_page.

    Args:
        pdf_path: Absolute file system path to the PDF file (e.g. /Users/alice/docs/report.pdf).
                  Must be an absolute path — relative paths and URLs are not accepted.

    Returns:
        The total page count as a string (e.g. "11").
    """
    _validate_path(pdf_path)
    result = _call_pdf_api("/page-count", pdf_path)
    return str(result["total"])


@mcp.tool
def pdf_get_page(pdf_path: str, page_number: int, dpi: int = 150) -> PageContent:
    """Render a single PDF page as an image and return it for visual analysis.

    Use this tool to read or inspect a specific page of a PDF. The returned
    image can be analyzed for text, diagrams, tables, and layout.

    Prefer this over pdf_get_all_pages when:
      - The PDF has more than 20 pages.
      - Only certain pages are relevant to the user's question.
      - Token budget is a concern.

    Args:
        pdf_path: Absolute file system path to the PDF file (e.g. /Users/alice/docs/report.pdf).
                  Must be an absolute path — relative paths and URLs are not accepted.
        page_number: Page to render, counted from 1. Page 1 is the first page.
        dpi: Render resolution. 150 (default) works well for normal text.
             Use 300 for small print or fine graphics, 72 to minimize size.
             Must be between 72 and 300.

    Returns:
        A list of 3 content blocks for the requested page:
          [0] TextContent:      label string, e.g. "Page 1"
          [1] ImageContent:     PNG image (mimeType="image/png", data=base64)
          [2] EmbeddedResource: BlobResourceContents
    """
    _validate_path(pdf_path)
    if not (72 <= dpi <= 300):
        raise ValueError("dpi must be between 72 and 300")
    result = _call_pdf_api("/render-page", pdf_path, page=page_number, dpi=dpi)
    png_bytes = base64.b64decode(result["png_base64"])
    return [
        TextContent(type="text", text=f"Page {result['pageNumber']}"),
        Image(data=png_bytes, format="png").to_image_content(),
        _to_blob_resource(png_bytes, result["pageNumber"]),
    ]


@mcp.tool
def pdf_get_all_pages(pdf_path: str, dpi: int = 150) -> PageContent:
    """Render all pages of a PDF as images and return them for visual analysis.

    Use this tool when the user wants to read or review the entire document.
    Limited to PDFs with 20 pages or fewer.

    Args:
        pdf_path: Absolute file system path to the PDF file (e.g. /Users/alice/docs/report.pdf).
                  Must be an absolute path — relative paths and URLs are not accepted.
        dpi: Render resolution. 150 (default) works well for normal text.
             Use 300 for small print or fine graphics, 72 to minimize size.
             Must be between 72 and 300.

    Returns:
        A flat list of 3 × N content blocks (N = total pages).
    """
    _validate_path(pdf_path)
    if not (72 <= dpi <= 300):
        raise ValueError("dpi must be between 72 and 300")

    count_result = _call_pdf_api("/page-count", pdf_path)
    total = count_result["total"]

    if total > MAX_PAGES_ALL:
        raise ValueError(
            f"PDF has {total} pages, which exceeds the {MAX_PAGES_ALL}-page limit. "
            "Use pdf_get_page to fetch individual pages."
        )

    content: PageContent = []
    for page_num in range(1, total + 1):
        result = _call_pdf_api("/render-page", pdf_path, page=page_num, dpi=dpi)
        png_bytes = base64.b64decode(result["png_base64"])
        content.append(TextContent(type="text", text=f"Page {page_num} of {total}"))
        content.append(Image(data=png_bytes, format="png").to_image_content())
        content.append(_to_blob_resource(png_bytes, page_num))
    return content


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
