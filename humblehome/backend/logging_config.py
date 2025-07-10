import logging
import os


def setup_logging():
    # Ensure log directory exists
    log_path = '/app/log/humblehome/app.log'
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    
    logger = logging.getLogger("humblehome_logger")  # Custom logger
    logger.setLevel(logging.INFO)

    # File handler
    file_handler = logging.FileHandler(log_path, mode="a")
    file_handler.setFormatter(
        logging.Formatter(
            """%(asctime)s
                                                %(levelname)s: %(message)s"""
        )
    )

    # Console handler
    # console_handler = logging.StreamHandler()
    # console_handler.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))

    # Avoid duplicate handlers
    if not logger.handlers:
        logger.addHandler(file_handler)
        # logger.addHandler(console_handler)

    return logger
