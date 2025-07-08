from flask import Blueprint, request, jsonify
from db import get_db
from werkzeug.security import generate_password_hash
import logging

password_reset_bp = Blueprint('password_reset', __name__)

@password_reset_bp.route('/resetpassword', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')
    
    if not token or not new_password:
        return jsonify({'message': 'Token and new password are required', 'success': False}), 400
    
    
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    try:
        db.start_transaction()
        
        # Check token validity and lock the row
        cursor.execute("""
            SELECT user_id, used 
            FROM password_reset_tokens 
            WHERE token = %s 
            AND expires_at > NOW()
            FOR UPDATE
        """, (token,))
        token_record = cursor.fetchone()
        
        if not token_record:
            return jsonify({
                'message': 'Invalid or expired token',
                'success': False
            }), 400
            
        if token_record['used']:
            return jsonify({
                'message': 'This token has already been used',
                'success': False
            }), 400
        
        # Update password
        hashed_password = generate_password_hash(new_password)
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE user_id = %s",
            (hashed_password, token_record['user_id'])
        )
        
        # Mark token as used
        cursor.execute("""
            UPDATE password_reset_tokens 
            SET used = TRUE 
            WHERE token = %s
        """, (token,))
        
        db.commit()
        
        return jsonify({
            'message': 'Password updated successfully',
            'success': True
        }), 200
        
    except Exception as e:
        db.rollback()
        logging.error(f"Error resetting password: {str(e)}")
        return jsonify({
            'message': 'An error occurred while resetting password',
            'success': False
        }), 500
    finally:
        cursor.close()