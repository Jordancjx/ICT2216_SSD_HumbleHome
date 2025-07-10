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
RUN chmod -R 777 /app/logs

# Create uploads folders and set permissions so www-data can write
RUN mkdir -p /app/uploads/models /app/uploads/images
RUN chown -R www-data:www-data /app/uploads
RUN chmod -R u+rwX /app/uploads

# Set correct permissions after COPY step
RUN chown -R www-data:www-data /app && chmod -R u+rwX /app/logs

# Switch to non-root user
USER www-data

EXPOSE 8888
CMD ["python3", "app.py"]
