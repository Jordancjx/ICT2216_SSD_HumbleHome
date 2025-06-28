FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy app files
COPY . .

# Expose port 8888
EXPOSE 8888

# Run Flask in production mode on port 8888 without debug
#CMD ["flask", "run", "--host=0.0.0.0", "--port=8888"]
CMD ["python", "app.py"]