FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m app && chown -R app /app
USER app
EXPOSE 8000
# Migrate and seed on boot (both idempotent), then serve HTTP + WebSockets with Daphne.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_lessons && daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]
