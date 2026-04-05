import pytest
import fitz


@pytest.fixture(scope="session")
def sample_pdf(tmp_path_factory) -> str:
    """1ページのテスト用PDFを生成して絶対パスを返す。"""
    path = tmp_path_factory.mktemp("pdf") / "sample.pdf"
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4
    page.insert_text((72, 100), "Page 1 - Hello PDF", fontsize=20)
    doc.save(str(path))
    doc.close()
    return str(path)


@pytest.fixture(scope="session")
def multi_page_pdf(tmp_path_factory) -> str:
    """3ページのテスト用PDFを生成して絶対パスを返す。"""
    path = tmp_path_factory.mktemp("pdf") / "multi.pdf"
    doc = fitz.open()
    for i in range(1, 4):
        page = doc.new_page(width=595, height=842)
        page.insert_text((72, 100), f"Page {i}", fontsize=20)
    doc.save(str(path))
    doc.close()
    return str(path)
