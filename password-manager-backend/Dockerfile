FROM python:3.12.14-slim-bookworm AS builder
ENV PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY password_manager/requirements.production.lock ./requirements.production.lock
RUN pip wheel --wheel-dir=/wheels -r requirements.production.lock

FROM python:3.12.14-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /wheels /wheels
COPY password_manager/requirements.production.lock /tmp/requirements.production.lock
RUN pip install --no-index --find-links=/wheels -r /tmp/requirements.production.lock && rm -rf /wheels
RUN useradd --create-home app
WORKDIR /app
COPY --chown=app:app password_manager/ ./
COPY --chown=app:app start.sh /app/start.sh
USER app
EXPOSE 8000
CMD ["/bin/sh", "/app/start.sh"]
