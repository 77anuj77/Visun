# Visun API — production image.
#
# The image deliberately contains no .env, database, or developer credentials.
# Every secret is supplied at runtime by docker/env/backend.env.
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install the pinned resolver from PyPI instead of the GHCR image so the
# build does not depend on a second container registry.
RUN pip install --no-cache-dir uv==0.11.32

WORKDIR /app

# Resolve dependencies before copying source so code edits reuse the layer.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --extra agent --extra providers

COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
COPY entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh

RUN groupadd --system --gid 10001 visun \
    && useradd --system --uid 10001 --gid visun --home-dir /app visun \
    && mkdir -p /data \
    && chown -R visun:visun /app /data

USER visun

ENV DATABASE_URL=sqlite:////data/visun.db
VOLUME ["/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/api/v1/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
