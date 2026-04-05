"""MCP server テスト（pdf_routes をインプロセスで呼び出す）"""
import sys
from pathlib import Path

import fitz
import httpx
import pytest
from mcp.types import TextContent, ImageContent, EmbeddedResource, BlobResourceContents

# backend/src を import パスに追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend" / "src"))
from pdf_image_mcp.server import pdf_page_count, pdf_get_page, pdf_get_all_pages  # noqa: E402


# --- pdf_page_count ---

def test_pdf_page_count(sample_pdf):
    assert pdf_page_count(sample_pdf) == "1"


def test_pdf_page_count_multi(multi_page_pdf):
    assert pdf_page_count(multi_page_pdf) == "3"


def test_pdf_page_count_relative_path():
    with pytest.raises(ValueError, match="absolute path"):
        pdf_page_count("relative/path.pdf")


def test_pdf_page_count_not_found():
    with pytest.raises(FileNotFoundError):
        pdf_page_count("/nonexistent/file.pdf")


def test_pdf_page_count_not_pdf(tmp_path):
    f = tmp_path / "file.txt"
    f.write_text("hello")
    with pytest.raises(ValueError, match=".pdf"):
        pdf_page_count(str(f))


# --- pdf_get_page ---

def test_pdf_get_page_returns_text_and_image(sample_pdf):
    result = pdf_get_page(sample_pdf, 1)
    assert len(result) == 3
    assert isinstance(result[0], TextContent)
    assert isinstance(result[1], ImageContent)
    assert isinstance(result[2], EmbeddedResource)


def test_pdf_get_page_text_label(sample_pdf):
    result = pdf_get_page(sample_pdf, 1)
    assert result[0].text == "Page 1"


def test_pdf_get_page_image_mime(sample_pdf):
    result = pdf_get_page(sample_pdf, 1)
    assert result[1].mimeType == "image/png"
    assert len(result[1].data) > 0


def test_pdf_get_page_blob_resource(sample_pdf):
    result = pdf_get_page(sample_pdf, 1)
    blob = result[2].resource
    assert isinstance(blob, BlobResourceContents)
    assert blob.mimeType == "image/png"
    assert str(blob.uri) == "pdf-image://page/1"
    assert len(blob.blob) > 0


def test_pdf_get_page_invalid_dpi(sample_pdf):
    with pytest.raises(ValueError, match="dpi"):
        pdf_get_page(sample_pdf, 1, dpi=50)
    with pytest.raises(ValueError, match="dpi"):
        pdf_get_page(sample_pdf, 1, dpi=400)


def test_pdf_get_page_out_of_range(sample_pdf):
    with pytest.raises(httpx.HTTPStatusError):
        pdf_get_page(sample_pdf, 99)


# --- pdf_get_all_pages ---

def test_pdf_get_all_pages_count(multi_page_pdf):
    result = pdf_get_all_pages(multi_page_pdf)
    assert len(result) == 9


def test_pdf_get_all_pages_types(multi_page_pdf):
    result = pdf_get_all_pages(multi_page_pdf)
    for i in range(0, len(result), 3):
        assert isinstance(result[i], TextContent)
        assert isinstance(result[i + 1], ImageContent)
        assert isinstance(result[i + 2], EmbeddedResource)


def test_pdf_get_all_pages_labels(multi_page_pdf):
    result = pdf_get_all_pages(multi_page_pdf)
    assert result[0].text == "Page 1 of 3"
    assert result[3].text == "Page 2 of 3"
    assert result[6].text == "Page 3 of 3"


def test_pdf_get_all_pages_blob_resources(multi_page_pdf):
    result = pdf_get_all_pages(multi_page_pdf)
    for page_num, i in enumerate(range(2, len(result), 3), start=1):
        blob = result[i].resource
        assert isinstance(blob, BlobResourceContents)
        assert blob.mimeType == "image/png"
        assert str(blob.uri) == f"pdf-image://page/{page_num}"


def test_pdf_get_all_pages_exceeds_limit(tmp_path):
    path = tmp_path / "big.pdf"
    doc = fitz.open()
    for _ in range(21):
        doc.new_page()
    doc.save(str(path))
    doc.close()
    with pytest.raises(ValueError, match="exceeds"):
        pdf_get_all_pages(str(path))
