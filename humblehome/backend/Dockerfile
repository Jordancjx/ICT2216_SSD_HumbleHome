FROM python:3.11-slim
WORKDIR /app

ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
EXPOSE 8888
COPY . .

# Assuming working directory is /app
WORKDIR /app

# Create logs directory with open permissions (or set to appropriate user)
RUN mkdir -p logs && chmod -R 777 logs

# Change ownership of app files to www-data
RUN chown -R www-data:www-data /app

# Switch to www-data user
USER www-data
CMD ["flask", "run", "--debug"]