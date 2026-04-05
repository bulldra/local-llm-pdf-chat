import sys
from pathlib import Path

import pytest

# backend/src をインポートパスに追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from render_server import app  # noqa: E402

from httpx import ASGITransport, AsyncClient  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
