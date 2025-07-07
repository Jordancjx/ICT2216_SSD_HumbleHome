FROM python:3.11-slim
WORKDIR /app

ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

# Copy all app source code (including /logs if it exists locally)
COPY . .

# Ensure /app/logs exists, even if not in host
RUN mkdir -p /app/logs

# Set correct permissions after COPY step
RUN chown -R www-data:www-data /app && chmod -R u+rwX /app/logs

# Switch to non-root user
# USER www-data

EXPOSE 8888
CMD ["python", "app.py"]
