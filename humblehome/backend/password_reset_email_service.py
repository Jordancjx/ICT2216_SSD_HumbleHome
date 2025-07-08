from flask import Blueprint, request, jsonify
import secrets
import datetime
from email.mime.text import MIMEText
import smtplib
import os
from db import get_db

bp = Blueprint('forgetpassword', __name__)

# Configuration - should be in environment variables
RESET_TOKEN_EXPIRY = 3600  # 1 hour in seconds
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_USERNAME = 'ictssd4321@gmail.com'
SMTP_PASSWORD = 'qhuy iszs sgql bipm'
FROM_EMAIL = 'noreply@yourdomain.com'

@bp.route('/forgotpassword', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'message': 'Email is required'}), 400
    
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    # 1. Check if email exists in database
    cursor.execute("SELECT user_id FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    
    if not user:
        # For security, don't reveal if email doesn't exist
        return jsonify({'message': 'If this email exists in our system, you will receive a password reset link'}), 200
    
    # 2. Generate reset token and expiry
    reset_token = secrets.token_urlsafe(32)
    expiry = datetime.datetime.now() + datetime.timedelta(seconds=RESET_TOKEN_EXPIRY)
    
    # 3. Store token in database
    cursor.execute(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
        (user['user_id'], reset_token, expiry)
    )
    db.commit()
    
    # 4. Send email
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    email_body = f"""
    You are receiving this message because you have requested a password reset on HumbleHome.
    Please click the link below to reset your password:
    
    {reset_link}
    
    This link will expire in 1 hour. If you did not request this, please ignore this email.
    
    HumbleHome Team
    """
    
    msg = MIMEText(email_body)
    msg['Subject'] = 'Password Reset Request'
    msg['From'] = FROM_EMAIL
    msg['To'] = email
    
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        # Log this error properly
        return jsonify({'message': 'Failed to send reset email'}), 500
    
    return jsonify({'message': 'Password reset link sent to your email'}), 200