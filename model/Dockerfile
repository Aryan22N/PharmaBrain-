FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY final_prescription_ocr_service_windows.py ./service.py

RUN mkdir -p /app/data /app/preprocessed /root/.paddlex

EXPOSE 8000

CMD ["python", "service.py"]