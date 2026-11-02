FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY coding_agent_py ./coding_agent_py
RUN uv sync --frozen --no-dev
RUN useradd -r -u 10001 app && chown -R app /app
USER app
EXPOSE 8090
CMD ["uv", "run", "--no-sync", "uvicorn", "coding_agent_py.app:app", "--host", "0.0.0.0", "--port", "8090"]
