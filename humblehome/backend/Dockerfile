FROM python:3.11-slim
WORKDIR /app

ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
EXPOSE 8888
COPY . .
CMD ["flask", "run", "--host=0.0.0.0", "--port=8888", "--debug"]