FROM python:3.11-slim
WORKDIR /app

ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

# Create logs directory and set permissions while still root
RUN mkdir -p /app/logs && chmod -R 777 /app/logs

# Copy source code
COPY . .

# Change ownership of app files to www-data
RUN chown -R www-data:www-data /app

# Switch to www-data user (after all privileged tasks)
USER www-data

EXPOSE 8888
CMD ["python", "app.py"]
