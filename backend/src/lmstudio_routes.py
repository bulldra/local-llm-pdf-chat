"""LM Studio リバースプロキシのルーター"""
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response, StreamingResponse

LMSTUDIO_BASE = "http://localhost:1234"

_HOP_BY_HOP = frozenset({
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "content-length",
    "content-encoding",
})

router = APIRouter()


@router.api_route("/lmstudio/{path:path}", methods=["GET", "POST"], include_in_schema=False)
async def lmstudio_proxy(request: Request, path: str) -> Response:
    """LM Studio へのリバースプロキシ（ストリーミング対応）"""
    url = f"{LMSTUDIO_BASE}/{path}"

    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length")
    }
    body = await request.body()

    client = httpx.AsyncClient(timeout=None)
    upstream = await client.send(
        client.build_request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
            params=dict(request.query_params),
        ),
        stream=True,
    )

    safe_headers = {
        k: v for k, v in upstream.headers.items()
        if k.lower() not in _HOP_BY_HOP
    }

    if "text/event-stream" in upstream.headers.get("content-type", ""):
        async def stream():
            try:
                async for chunk in upstream.aiter_raw():
                    yield chunk
            finally:
                await upstream.aclose()
                await client.aclose()
        return StreamingResponse(
            stream(),
            status_code=upstream.status_code,
            headers=safe_headers,
            media_type="text/event-stream",
        )

    content = await upstream.aread()
    await upstream.aclose()
    await client.aclose()
    return Response(
        content=content,
        status_code=upstream.status_code,
        headers=safe_headers,
    )
