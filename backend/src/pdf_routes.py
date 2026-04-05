"""PDF レンダリング関連のルーター"""
import asyncio
import base64
import io
import json

import fitz
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter()


@router.post("/render-pdf")
async def render_pdf_stream(
    file: UploadFile = File(...),
    dpi: int = Form(150),
) -> StreamingResponse:
    """ページを1枚ずつ NDJSON で返すストリーミングエンドポイント"""
    data = await file.read()

    async def generate():
        with fitz.open(stream=io.BytesIO(data), filetype="pdf") as doc:
            total = len(doc)
            matrix = fitz.Matrix(dpi / 72, dpi / 72)
            yield json.dumps({"total": total}) + "\n"
            await asyncio.sleep(0)
            for i, page in enumerate(doc):
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                png = pix.tobytes("png")
                b64 = base64.b64encode(png).decode()
                yield json.dumps({
                    "pageNumber": i + 1,
                    "width": pix.width,
                    "height": pix.height,
                    "dataUrl": f"data:image/png;base64,{b64}",
                }) + "\n"
                await asyncio.sleep(0)

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@router.post("/page-count")
async def page_count(file: UploadFile = File(...)) -> dict:
    """PDFのページ数を返す"""
    data = await file.read()
    with fitz.open(stream=io.BytesIO(data), filetype="pdf") as doc:
        return {"total": len(doc)}


@router.post("/render-page")
async def render_page(
    file: UploadFile = File(...),
    page: int = Form(...),
    dpi: int = Form(150),
) -> dict:
    """指定ページを1枚レンダリングしてbase64 PNGで返す"""
    data = await file.read()
    with fitz.open(stream=io.BytesIO(data), filetype="pdf") as doc:
        total = len(doc)
        if page < 1 or page > total:
            raise HTTPException(status_code=400, detail=f"Page {page} out of range (1-{total})")
        matrix = fitz.Matrix(dpi / 72, dpi / 72)
        pix = doc[page - 1].get_pixmap(matrix=matrix, alpha=False)
        png = pix.tobytes("png")
        b64 = base64.b64encode(png).decode()
        return {
            "pageNumber": page,
            "width": pix.width,
            "height": pix.height,
            "png_base64": b64,
        }
