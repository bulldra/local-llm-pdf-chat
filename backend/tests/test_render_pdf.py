"""PDF レンダリングエンドポイントのテスト"""
import json

import fitz
import pytest


def _make_pdf(pages: int = 1) -> bytes:
    """テスト用PDFをバイト列で生成"""
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text((72, 100), f"Page {i + 1}", fontsize=20)
    data = doc.tobytes()
    doc.close()
    return data


@pytest.mark.anyio
async def test_render_pdf_single_page(client):
    pdf = _make_pdf(1)
    resp = await client.post(
        "/render-pdf",
        files={"file": ("test.pdf", pdf, "application/pdf")},
        data={"dpi": "72"},
    )
    assert resp.status_code == 200
    lines = [json.loads(line) for line in resp.text.strip().split("\n")]
    assert lines[0]["total"] == 1
    assert lines[1]["pageNumber"] == 1
    assert lines[1]["dataUrl"].startswith("data:image/png;base64,")


@pytest.mark.anyio
async def test_render_pdf_multi_page(client):
    pdf = _make_pdf(3)
    resp = await client.post(
        "/render-pdf",
        files={"file": ("test.pdf", pdf, "application/pdf")},
        data={"dpi": "72"},
    )
    lines = [json.loads(line) for line in resp.text.strip().split("\n")]
    assert lines[0]["total"] == 3
    assert len(lines) == 4  # total + 3 pages
    for i in range(1, 4):
        assert lines[i]["pageNumber"] == i
