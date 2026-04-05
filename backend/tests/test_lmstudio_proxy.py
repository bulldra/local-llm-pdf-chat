"""LM Studio プロキシエンドポイントのテスト"""
import json
from unittest.mock import patch

import httpx
import pytest

_RealAsyncClient = httpx.AsyncClient


def _mock_response(body: dict, status: int = 200, content_type: str = "application/json"):
    content = json.dumps(body).encode()
    return httpx.Response(
        status_code=status,
        headers={"content-type": content_type},
        content=content,
    )


class FakeAsyncStream(httpx.AsyncByteStream):
    def __init__(self, chunks: list[str]):
        self._chunks = chunks

    async def __aiter__(self):
        for chunk in self._chunks:
            yield chunk.encode()


def _mock_sse_response(chunks: list[str]):
    return httpx.Response(
        status_code=200,
        headers={"content-type": "text/event-stream"},
        stream=FakeAsyncStream(chunks),
    )


class FakeAsyncClient:
    """httpx.AsyncClient の差し替え"""

    def __init__(self, handler, **kwargs):
        self._handler = handler
        self._real = _RealAsyncClient()

    def build_request(self, **kwargs):
        return self._real.build_request(**kwargs)

    async def send(self, request, **kwargs):
        return self._handler(request)

    async def aclose(self):
        await self._real.aclose()


def _patch_client(handler):
    return patch(
        "lmstudio_routes.httpx.AsyncClient",
        side_effect=lambda **kw: FakeAsyncClient(handler),
    )


@pytest.mark.anyio
async def test_proxy_get_models(client):
    """GET /lmstudio/v1/models をプロキシできる"""
    mock_body = {
        "data": [{"id": "test-model", "object": "model"}],
        "object": "list",
    }

    def handler(request):
        assert str(request.url) == "http://localhost:1234/v1/models"
        return _mock_response(mock_body)

    with _patch_client(handler):
        resp = await client.get("/lmstudio/v1/models")

    assert resp.status_code == 200
    data = resp.json()
    assert data["data"][0]["id"] == "test-model"


@pytest.mark.anyio
async def test_proxy_post_chat_completions(client):
    """POST /lmstudio/v1/chat/completions（非ストリーミング）"""
    mock_body = {
        "id": "chatcmpl-1",
        "choices": [{"message": {"content": "Hello!"}}],
    }

    def handler(request):
        assert request.method == "POST"
        assert "chat/completions" in str(request.url)
        body = json.loads(request.content)
        assert body["model"] == "test-model"
        return _mock_response(mock_body)

    with _patch_client(handler):
        resp = await client.post(
            "/lmstudio/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hi"}],
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["choices"][0]["message"]["content"] == "Hello!"


@pytest.mark.anyio
async def test_proxy_chat_completions_streaming(client):
    """POST /lmstudio/v1/chat/completions（SSEストリーミング）"""
    sse_chunks = [
        'data: {"choices":[{"delta":{"content":"He"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n',
        "data: [DONE]\n\n",
    ]

    def handler(request):
        return _mock_sse_response(sse_chunks)

    with _patch_client(handler):
        resp = await client.post(
            "/lmstudio/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        )

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]
    text = resp.text
    assert "He" in text
    assert "llo" in text
    assert "[DONE]" in text


@pytest.mark.anyio
async def test_proxy_upstream_error(client):
    """上流が500を返した場合もそのままプロキシする"""

    def handler(request):
        return _mock_response({"error": "internal"}, status=500)

    with _patch_client(handler):
        resp = await client.get("/lmstudio/v1/models")

    assert resp.status_code == 500


@pytest.mark.anyio
async def test_proxy_forwards_query_params(client):
    """クエリパラメータが上流に転送されることを確認"""
    captured_url = {}

    def handler(request):
        captured_url["url"] = str(request.url)
        return _mock_response({"ok": True})

    with _patch_client(handler):
        resp = await client.get("/lmstudio/v1/models?filter=loaded")

    assert resp.status_code == 200
    assert "filter=loaded" in captured_url["url"]
