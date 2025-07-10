from flask_cors import CORS
from db import close_db
import os
from logging_config import setup_logging
import sys
import signal
from werkzeug.middleware.proxy_fix import ProxyFix
from flask import Flask

logger = setup_logging()


# Not sure if this is needed, but keeping it for now
def handle_shutdown(signum, frame):
    logger.info("Flask app is shutting down.")
    sys.exit(0)


# Handle SIGINT (Ctrl+C) and SIGTERM (e.g., Docker stop)
signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)


def create_app():
    app = Flask(__name__)
    # Handles reverse proxy headers for Flask
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)
    app.config["SECRET_KEY"] = "supersecretkey"
    app.config["UPLOAD_FOLDER"] = os.path.join(os.getcwd(), "uploads", "models")

    # setup_logging() # --> if called here, can see HTTP requests in the log file
    logger.info("create_app() called")
    CORS(app, supports_credentials=True)

    from profile import profile_bp
    from auth import auth_bp
    from products import products_bp
    from purchase import purchases_bp

    app.register_blueprint(profile_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(purchases_bp)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    app.teardown_appcontext(close_db)
    return app


if __name__ == "__main__":
    try:
        logger.info("Starting Flask app...")
        app = create_app()

        # CSP
        @app.after_request
        def set_csp(response):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "object-src 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            )
            return response

        UPLOAD_FOLDER = "uploads/models"
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        app.run(host="0.0.0.0", port=8888)
        logger.info("Flask app ended/shutdown.")
    except Exception as e:
        logger.exception(f"Error starting Flask app: {e}")
