from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from db import get_db, close_db
import os
from logging_config import setup_logging
import sys
import signal

logger = setup_logging()

# Not sure if this is needed, but keeping it for now
# def handle_shutdown(signum, frame):
#     logger.info("Flask app is shutting down.")
#     sys.exit(0)
    
# # Handle SIGINT (Ctrl+C) and SIGTERM (e.g., Docker stop)
# signal.signal(signal.SIGINT, handle_shutdown)
# signal.signal(signal.SIGTERM, handle_shutdown)

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'supersecretkey'
    app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads', 'models')

    # setup_logging() # --> if called here, can see requests in the log file
    logger.info("create_app() called")
    CORS(app, supports_credentials=True)

    from profile import profile_bp
    from auth import auth_bp
    from products import products_bp
    from purchase import purchases_bp
    # from resetpassword import bp
    # from password_reset import password_reset_bp
    
    # app.register_blueprint(bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(purchases_bp)
    # app.register_blueprint(password_reset_bp)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.teardown_appcontext(close_db)
    return app

if __name__ == "__main__":
    try:
        logger.info("Starting Flask app...")
        app = create_app()
        logger.info("Flask app started successfully.")
        UPLOAD_FOLDER = 'uploads/models'
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        app.run(host="0.0.0.0", port=8888)
        logger.info("Flask app ended/shutdown.")
    except Exception as e:
        logger.exception(f"Error starting Flask app: {e}")