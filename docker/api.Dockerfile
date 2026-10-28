# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:0.13.4 AS uv
FROM python:3.12-slim-bookworm AS build
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.12-slim-bookworm AS runtime
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=8080
WORKDIR /app
RUN groupadd --gid 10001 hablar && useradd --uid 10001 --gid hablar --no-create-home hablar
COPY --from=build /app/.venv /app/.venv
COPY artifacts/api-server/fastapi_app.py ./
COPY artifacts/api-server/email_delivery.py ./
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ['PORT']+'/api/healthz', timeout=3)" || exit 1
CMD ["sh", "-c", "exec uvicorn fastapi_app:app --host 0.0.0.0 --port \"${PORT}\" --no-access-log"]
