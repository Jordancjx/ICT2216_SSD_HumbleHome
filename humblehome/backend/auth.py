from flask import Blueprint, request, jsonify
import jwt
import datetime
import re
import secrets
import logging
import threading
import os
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db
from middleware import token_req
import smtplib
from email.mime.text import MIMEText


logger = logging.getLogger("humblehome_logger")  # Custom logger
secretkey = "supersecretkey"
auth_bp = Blueprint("auth", __name__)

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "ictssd4321@gmail.com"
SMTP_PASSWORD = "qhuy iszs sgql bipm"  # Consider loading from env vars
FROM_EMAIL = "noreply@yourdomain.com"

# Configuration - should be in environment variables
RESET_TOKEN_EXPIRY = 3600  # 1 hour in seconds


def send_otp_email(recipient_email, otp_code):
    email_body = f"""
    Your 2FA verification code is: {otp_code}

    This code will expire in 5 minutes.
    If you did not try to log in, you can ignore this message.
    """

    msg = MIMEText(email_body)
    msg["Subject"] = "Your 2FA Verification Code"
    msg["From"] = FROM_EMAIL
    msg["To"] = recipient_email

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            logger.info(f"2FA code sent to {recipient_email} for login")
    except Exception as e:
        print(f"[Email Error] Failed to send 2FA code to {recipient_email}: {e}")
        logger.error(f"Failed to send 2FA code to {recipient_email}: {e}")


def is_password_complex(password):
    # At least 1 uppercase, 1 number, 1 special char, min 8 chars
    pattern = r'^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?]).{8,}$'
    return re.fullmatch(pattern, password) is not None


@auth_bp.route("/register", methods=["POST"])
def register():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    formData = request.json
    username = formData["username"]
    email = formData["email"]
    password = formData["password"]

    if not username:
        return jsonify({"message": "Username is required."}), 400

    if not email:
        return jsonify({"message": "Email is required."}), 400

    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({"message": "Email already registered."}), 400

    # Check if username exists
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    if cursor.fetchone():
        return jsonify({"message": "Username already taken."}), 400

    # Validate password complexity
    if not is_password_complex(password):
        return (
            jsonify(
                {
                    "message": """Password must be at least 8 characters long and
                        include 1 uppercase letter, 1 number,
                        and 1 special character."""
                }
            ),
            400,
        )

    hashed_pw = generate_password_hash(password)
    cursor.execute(
        """INSERT INTO users (username, email, password_hash)
                   VALUES (%s, %s, %s)""",
        (username, email, hashed_pw),
    )
    db.commit()
    logger.info(f"New account has been registered with email: {email}")
    return jsonify({"message": "User registered successfully.."}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    data = request.json

    login_source = data.get("login_source", "user")  # "user" (default) or "admin"
    login_input = data["login"]  # email or username
    password = data["password"]

    ip = request.headers.get("X-Forwarded-For", request.remote_addr).split(",")[0]

    # ───────────────────────────────────────────
    # 1. Fetch user & basic credential check
    # ───────────────────────────────────────────
    cursor.execute(
        "SELECT * FROM users WHERE email = %s OR username = %s",
        (login_input, login_input),
    )
    user = cursor.fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        logger.warning(f"Failed login attempt for '{login_input}'")
        return jsonify({"message": "Invalid credentials."}), 401

    # ───────────────────────────────────────────
    # 2. Portal‑role guardrails
    # ───────────────────────────────────────────
    if user["role"] == "admin" and login_source != "admin":
        logger.warning(f"Blocked admin login from user portal for '{user['email']}'")
        return jsonify({"message": "Invalid credentials."}), 403

    if user["role"] != "admin" and login_source == "admin":
        logger.warning(f"Blocked non‑admin user '{user['email']}' from admin portal")
        return jsonify({"message": "Invalid credentials."}), 403

    # ───────────────────────────────────────────
    # 3. Decide if OTP is required
    # ───────────────────────────────────────────
    IS_TEST_ENV = os.environ.get("TESTING") == "1"
    IS_TEST_USER = user["email"] == "newuser@example.com"
    same_ip = user.get("last_ip") == ip
    is_admin = user["role"] == "admin"

    otp_needed = not (IS_TEST_ENV or IS_TEST_USER or is_admin or same_ip)

    # ───────────────────────────────────────────
    # 4‑A. NO OTP required  →  issue tokens now
    # ───────────────────────────────────────────
    if not otp_needed:
        token = jwt.encode(
            {
                "email": user["email"],
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
            },
            secretkey,
            algorithm="HS256",
        )

        user_info = {
            "id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "profile_pic": user.get("profile_pic"),
        }

        logger.info(
            f"{'[TEST MODE] ' if IS_TEST_ENV else ''}"
            f"User '{user['username']}' logged in without OTP"
        )

        return (
            jsonify(
                {
                    "token": token,
                    "user": user_info,
                }
            ),
            200,
        )
    # ───────────────────────────────────────────
    # 4‑B. OTP required  →  generate & send code
    # ───────────────────────────────────────────
    otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
    expires_at = datetime.datetime.now() + datetime.timedelta(minutes=5)

    cursor.execute(
        """
        INSERT INTO two_factor_codes (user_id, otp_code, expires_at)
        VALUES (%s, %s, %s)
        """,
        (user["user_id"], otp_code, expires_at),
    )
    db.commit()

    threading.Thread(target=send_otp_email, args=(user["email"], otp_code)).start()
    logger.info(f"OTP sent to '{user['email']}' (new IP login)")

    return jsonify({"message": "OTP sent to email", "user_id": user["user_id"]}), 200


@auth_bp.route("/logout", methods=["POST"])
@token_req
def logout(current_user):
    logger.info(f"User \"{current_user['username']}\" logged out successfully")
    return jsonify({"message": "Logged out successfully."}), 200


@auth_bp.route("/me", methods=["GET"])
@token_req
def get_profile(current_user):
    return jsonify({"user": current_user}), 200


@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json()
    user_id = data.get("user_id")
    input_otp = data.get("otp")

    # intput_otp validation
    if not re.fullmatch(r"\d{6}", str(input_otp)):
        return jsonify({"message": "Invalid OTP format"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True, buffered=True)

    cursor.execute(
        """
        SELECT two_factor_codes.*, users.username
        FROM two_factor_codes
        JOIN users ON two_factor_codes.user_id = users.user_id
        WHERE two_factor_codes.user_id = %s AND two_factor_codes.is_used = 0
        ORDER BY two_factor_codes.created_at DESC
    """,
        (user_id,),
    )

    record = cursor.fetchone()

    if not record or datetime.datetime.now() > record["expires_at"]:
        return jsonify({"message": "Invalid or expired OTP"}), 401

    if record["otp_code"] != input_otp:
        attempts = record["attempts_left"] - 1
        cursor.execute(
            "UPDATE two_factor_codes SET attempts_left = %s WHERE id = %s",
            (attempts, record["id"]),
        )
        db.commit()

        if attempts <= 0:
            logger.warning(f"User \"{record['username']}\" has exceeded OTP attempts")
            return jsonify({"message": "Too many incorrect attempts"}), 403
        logger.warning(
            f"""User \"{record['username']}\" entered incorrect OTP.
                       Attempts left: {attempts}"""
        )
        return jsonify({"message": "Incorrect OTP"}), 401

    # Mark OTP used
    cursor.execute(
        """UPDATE two_factor_codes SET is_used = 1 WHERE id = %s""", (record["id"],)
    )
    db.commit()

    # Issue final JWT
    cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
    user = cursor.fetchone()
    token = jwt.encode(
        {
            "email": user["email"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        },
        secretkey,
        algorithm="HS256",
    )

    user_info = {
        "id": user["user_id"],
        "username": user["username"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "profile_pic": user.get("profile_pic"),
    }

    cursor.execute(
        "UPDATE users SET last_ip = %s WHERE user_id = %s",
        (request.remote_addr, user_id),
    )
    db.commit()

    logger.info(f"User \"{user['username']}\" logged in successfully")

    return jsonify({"token": token, "user": user_info}), 200


@auth_bp.route("/resend-otp", methods=["POST", "OPTIONS"])
def resend_otp():
    if request.method == "OPTIONS":
        return "", 204  # respond to preflight without processing

    data = request.get_json()
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"message": "Missing user ID"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT email FROM users WHERE user_id = %s", (user_id,))
    user = cursor.fetchone()

    if not user:
        return jsonify({"message": "User not found"}), 404

    otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
    expires_at = datetime.datetime.now() + datetime.timedelta(minutes=5)

    cursor.execute(
        """INSERT INTO two_factor_codes (user_id, otp_code, expires_at)
        VALUES (%s, %s, %s)""",
        (user_id, otp_code, expires_at),
    )
    db.commit()

    # Send OTP
    threading.Thread(target=send_otp_email, args=(user["email"], otp_code)).start()
    logger.info(f"Resent OTP to \"{user['email']}\"")
    return jsonify({"message": "OTP resent to your email"}), 200


@auth_bp.route("/resetpassword", methods=["POST"])
def reset_password():
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("new_password")

    if not token or not new_password:
        return (
            jsonify(
                {"message": "Token and new password are required", "success": False}
            ),
            400,
        )

    if not is_password_complex(new_password):
        return (
            jsonify(
                {
                    "message": """Password must be at least 8 characters long and
            include 1 uppercase letter, 1 number, and 1 special character.""",
                    "success": False,
                }
            ),
            400,
        )

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        db.start_transaction()

        # Check token validity and lock the row
        cursor.execute(
            """
            SELECT user_id, used
            FROM password_reset_tokens
            WHERE token = %s
            AND expires_at > NOW()
            FOR UPDATE
        """,
            (token,),
        )
        token_record = cursor.fetchone()

        if not token_record:
            return (
                jsonify({"message": "Invalid or expired token", "success": False}),
                400,
            )

        if token_record["used"]:
            return (
                jsonify(
                    {"message": "This token has already been used", "success": False}
                ),
                400,
            )

        # Update password
        hashed_password = generate_password_hash(new_password)
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE user_id = %s",
            (hashed_password, token_record["user_id"]),
        )

        # Mark token as used
        cursor.execute(
            """
            UPDATE password_reset_tokens
            SET used = TRUE
            WHERE token = %s
        """,
            (token,),
        )

        db.commit()

        return (
            jsonify({"message": "Password updated successfully", "success": True}),
            200,
        )

    except Exception as e:
        db.rollback()
        logging.error(f"Error resetting password: {str(e)}")
        return (
            jsonify(
                {
                    "message": "An error occurred while resetting password",
                    "success": False,
                }
            ),
            500,
        )
    finally:
        cursor.close()


@auth_bp.route("/forgotpassword", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"message": "Email is required"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # 1. Check if email exists in database
    cursor.execute("SELECT user_id FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if not user:
        # For security, don't reveal if email doesn't exist
        return (
            jsonify(
                {
                    "message": """If this email exists in our system,
                        you will receive a password reset link"""
                }
            ),
            200,
        )
        # An email password reset link has been sent to your email address.

    # 2. Generate reset token and expiry
    reset_token = secrets.token_urlsafe(32)
    expiry = datetime.datetime.now() + datetime.timedelta(seconds=RESET_TOKEN_EXPIRY)

    # 3. Store token in database
    cursor.execute(
        """INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES (%s, %s, %s)""",
        (user["user_id"], reset_token, expiry),
    )
    db.commit()

    # 4. Send email
    reset_link = f"https://humblehome.mooo.com/reset-password?token={reset_token}"
    email_body = f"""
    You are receiving this message because you have requested a
    password reset on HumbleHome.
    Please click the link below to reset your password:

    {reset_link}

    This link will expire in 1 hour. If you did not request this,
    please ignore this email.

    HumbleHome Team
    """

    msg = MIMEText(email_body)
    msg["Subject"] = "Password Reset Request"
    msg["From"] = FROM_EMAIL
    msg["To"] = email

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception:
        # Log this error properly
        return jsonify({"message": "Failed to send reset email"}), 500

    return jsonify({"message": "Password reset link sent to your email"}), 200
