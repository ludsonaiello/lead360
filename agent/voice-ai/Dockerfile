FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY requirements.txt* .

RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || pip install --no-cache-dir .

COPY agent/ ./agent/

CMD ["python", "-m", "agent.main"]
