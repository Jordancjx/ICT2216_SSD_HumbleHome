from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from db import get_db, close_db
import os

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'supersecretkey'
    app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads', 'models')
    CORS(app, supports_credentials=True)

    from profile import profile_bp
    from auth import auth_bp
    from products import products_bp
    
    app.register_blueprint(profile_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(products_bp)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.teardown_appcontext(close_db)
    return app

if __name__ == "__main__":
    app = create_app()
    UPLOAD_FOLDER = 'uploads/models'
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(host="0.0.0.0", port=8888, ssl_context=("/app/certs/fullchain.pem", "/app/certs/privkey.pem"))