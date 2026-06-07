FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# Install dependencies first for better layer caching.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Application source + migrations.
COPY src ./src
COPY alembic ./alembic
COPY alembic.ini ./
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

# Apply DB migrations, then serve. (In k8s, migrations run as a separate Job;
# this inline upgrade keeps single-host Docker Compose self-contained.)
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn hometable.main:app --host 0.0.0.0 --port 8000"]
