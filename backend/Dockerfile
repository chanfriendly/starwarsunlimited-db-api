# Stage 1: Builder
FROM python:3.10-slim AS builder

WORKDIR /app

# Install build dependencies
RUN pip install --no-cache-dir poetry

# Copy poetry configuration and install dependencies
COPY poetry.lock pyproject.toml ./
RUN poetry install --no-dev --no-interaction --no-ansi

# Stage 2: Runner
FROM python:3.10-slim AS runner

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv ./.venv

# Activate virtual environment
ENV PATH="/app/.venv/bin:$PATH"

# Copy application code
COPY src ./src

# Expose the port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
