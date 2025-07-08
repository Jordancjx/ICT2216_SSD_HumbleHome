from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import jwt, datetime, re, secrets
from db import get_db
from middleware import token_req
import smtplib
from email.mime.text import MIMEText
import logging, threading

logger = logging.getLogger('humblehome_logger')  # Custom logger
secretkey = 'supersecretkey'
auth_bp = Blueprint('auth', __name__)

SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_USERNAME = 'ictssd4321@gmail.com'
SMTP_PASSWORD = 'qhuy iszs sgql bipm'  # Consider loading from env vars
FROM_EMAIL = 'noreply@yourdomain.com'

def send_otp_email(recipient_email, otp_code):
    email_body = f"""
    Your 2FA verification code is: {otp_code}

    This code will expire in 5 minutes. If you did not try to log in, you can ignore this message.
    """

    msg = MIMEText(email_body)
    msg['Subject'] = 'Your 2FA Verification Code'
    msg['From'] = FROM_EMAIL
    msg['To'] = recipient_email

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        print(f"[Email Error] Failed to send 2FA code to {recipient_email}: {e}")

def is_password_complex(password):
    # At least 1 uppercase, 1 number, 1 special char, min 8 chars
    pattern = r'^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?]).{8,}$'
    return re.fullmatch(pattern, password) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    formData = request.json
    username = formData['username']
    email = formData['email']
    password = formData['password']
    
    if not username:
        return jsonify({'message': 'Username is required.'}), 400
    
    if not email:
        return jsonify({'message': 'Email is required.'}), 400
    
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({'message': 'Email already registered.'}), 400
    
    # Check if username exists
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    if cursor.fetchone():
        return jsonify({'message': 'Username already taken.'}), 400
    
    # Validate password complexity
    if not is_password_complex(password):
        return jsonify({'message': 'Password must be at least 8 characters long and include 1 uppercase letter, 1 number, and 1 special character.'}), 400
    
    hashed_pw = generate_password_hash(password)
    cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)", (username, email, hashed_pw))
    db.commit()
    logger.info(f"New account has been registered with email: {email}")
    return jsonify({'message':'User registered successfully..'}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    formData = request.json
    loginInput = formData['login']
    password = formData['password']
    
    ip = request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0]

    cursor.execute("SELECT * FROM users WHERE email = %s OR username = %s", (loginInput, loginInput))
    user = cursor.fetchone()

    if not user or not check_password_hash(user['password_hash'], password):
        logger.warning(f"Failed login attempt for {loginInput}")
        return jsonify({'message': 'Invalid credentials'}), 401

    stored_ip = user.get('last_ip')
    if stored_ip != ip and user['role'] != 'admin': # Skip 2FA for admin users
        # IP is new — trigger 2FA
        otp_code = ''.join(secrets.choice('0123456789') for _ in range(6))
        expires_at = datetime.datetime.now() + datetime.timedelta(minutes=5)

        cursor.execute(
            "INSERT INTO two_factor_codes (user_id, otp_code, expires_at) VALUES (%s, %s, %s)",
            (user['user_id'], otp_code, expires_at)
        )
        db.commit()

        threading.Thread(target=send_otp_email, args=(user['email'], otp_code)).start()
        return jsonify({'message': 'OTP sent to email', 'user_id': user['user_id']}), 200
    else:
        # IP matches — skip 2FA
        token = jwt.encode(
            {'email': user['email'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
            secretkey,
            algorithm='HS256'
        )

        user_info = {
            'id': user['user_id'],
            'username': user['username'],
            'email': user['email'],
            'role': user.get('role', 'user'),
            'profile_pic': user.get('profile_pic')
        }

        return jsonify({'token': token, 'user': user_info}), 200


@auth_bp.route('/logout', methods=['POST'])
@token_req
def logout(current_user):
    logger.info(f"User \"{current_user['username']}\" logged out successfully")
    return jsonify({'message': 'Logged out successfully.'}), 200

@auth_bp.route('/me', methods=['GET'])
@token_req
def get_profile(current_user):
    return jsonify({'user':current_user}), 200

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    user_id = data.get('user_id')
    input_otp = data.get('otp')

    # intput_otp validation
    if not re.fullmatch(r"\d{6}", str(input_otp)):
        return jsonify({'message': 'Invalid OTP format'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True, buffered=True)

    #Get latest unexpired code
    cursor.execute(
        "SELECT * FROM two_factor_codes WHERE user_id = %s AND is_used = 0 ORDER BY created_at DESC",
        (user_id,)
    )

    record = cursor.fetchone()

    if not record or datetime.datetime.now() > record['expires_at']:
        return jsonify({'message': 'Invalid or expired OTP'}), 401

    if record['otp_code'] != input_otp:
        attempts = record['attempts_left'] - 1
        cursor.execute("UPDATE two_factor_codes SET attempts_left = %s WHERE id = %s", (attempts, record['id']))
        db.commit()

        if attempts <= 0:
            return jsonify({'message': 'Too many incorrect attempts'}), 403
        return jsonify({'message': 'Incorrect OTP'}), 401

    # Mark OTP used
    cursor.execute("UPDATE two_factor_codes SET is_used = 1 WHERE id = %s", (record['id'],))
    db.commit()

    # Issue final JWT
    cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
    user = cursor.fetchone()
    token = jwt.encode(
        {'email': user['email'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
        secretkey,
        algorithm='HS256'
    )

    user_info = {
        'id': user['user_id'],
        'username': user['username'],
        'email': user['email'],
        'role': user.get('role', 'user'),
        'profile_pic': user.get('profile_pic')
    }

    cursor.execute("UPDATE users SET last_ip = %s WHERE user_id = %s", (request.remote_addr, user_id))
    db.commit()

    return jsonify({'token': token, 'user': user_info}), 200

@auth_bp.route('/resend-otp', methods=['POST', 'OPTIONS'])
def resend_otp():
    if request.method == 'OPTIONS':
        return '', 204  # respond to preflight without processing
    
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({'message': 'Missing user ID'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT email FROM users WHERE user_id = %s", (user_id,))
    user = cursor.fetchone()

    if not user:
        return jsonify({'message': 'User not found'}), 404

    otp_code = ''.join(secrets.choice('0123456789') for _ in range(6))
    expires_at = datetime.datetime.now() + datetime.timedelta(minutes=5)

    cursor.execute(
        "INSERT INTO two_factor_codes (user_id, otp_code, expires_at) VALUES (%s, %s, %s)",
        (user_id, otp_code, expires_at)
    )
    db.commit()

    # Send OTP
    threading.Thread(target=send_otp_email, args=(user['email'], otp_code)).start()

    return jsonify({'message': 'OTP resent to your email'}), 200

