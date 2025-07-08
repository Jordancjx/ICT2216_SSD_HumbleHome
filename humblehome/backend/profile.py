from flask import Blueprint, request, jsonify, send_from_directory
import os
from werkzeug.utils import secure_filename
from db import get_db
from middleware import token_req
from PIL import Image, UnidentifiedImageError
import logging

logger = logging.getLogger('humblehome_logger')  # Custom logger
profile_bp = Blueprint('profile', __name__)

UPLOAD_FOLDER = os.path.join(os.getcwd(), 'static', 'uploads')
ALLOWED_EXTS = {'png', 'jpg', 'jpeg', 'gif'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTS

@profile_bp.route('/update-profile', methods=['PUT'])
@token_req
def updateProfile(current_user):
    data = request.json
    fullname = data['fullname']
    phonenumber = data['phonenumber']
    address = data['address']
    
    # Normalize values for comparison (handle None vs empty string)
    current_fullname = current_user.get('full_name') or ''
    current_phonenumber = current_user.get('phone_number') or ''
    current_address = current_user.get('address') or ''
    
    # Check which fields have been updated before making database changes
    updated_fields = []
    update_values = []
    update_columns = []
    
    if fullname != current_fullname:
        updated_fields.append('full_name')
        update_columns.append('full_name = %s')
        update_values.append(fullname)
    
    if phonenumber != current_phonenumber:
        updated_fields.append('phone_number')
        update_columns.append('phone_number = %s')
        update_values.append(phonenumber)
    
    if address != current_address:
        updated_fields.append('address')
        update_columns.append('address = %s')
        update_values.append(address)

    if updated_fields:
        db = get_db()
        cursor = db.cursor()
        
        # Only update the fields that actually changed
        update_query = f"UPDATE users SET {', '.join(update_columns)} WHERE user_id = %s"
        update_values.append(current_user['user_id'])
        
        cursor.execute(update_query, update_values)
        db.commit()
        
        logger.info(f"User \"{current_user['username']}\" updated their profile successfully! -- Fields Updated: {', '.join(updated_fields)}") # Do I state the the database was updated?
        return jsonify({'message': 'Profile updated successfully'}), 200
    else:
        logger.info(f'User "{current_user["username"]}" submitted profile update with no changes.')
        return jsonify({'message': 'No changes detected'}), 200

@profile_bp.route('/upload-profile-image', methods = ['POST'])
@token_req
def upload_pic(current_user):
    logger.info(f"User \"{current_user['username']}\" initiated profile image upload")
    
    if 'image' not in request.files:
        logger.error(f"User \"{current_user['username']}\" upload failed: No file is being uploaded")
        return jsonify({'error': 'No image part in req'}), 400
    
    file = request.files['image']
    
    # Check if file is None or has no filename
    if file is None:
        logger.error(f"User \"{current_user['username']}\" upload failed: File is null")
        return jsonify({'error': 'No file provided'}), 400
        
    if file.filename == '' or file.filename is None:
        logger.error(f"User \"{current_user['username']}\" upload failed: No file submitted or empty filename")
        return jsonify({'error': 'No file submitted'}), 400
    
    # Check file size (3MB limit)
    max_size = 3 * 1024 * 1024  # 3MB in bytes
    file.seek(0, os.SEEK_END)  # Move cursor to end of file
    file_length = file.tell()  # Get file size
    file.seek(0)  # Reset cursor position
    
    # Check if file is completely empty (0 bytes)
    if file_length == 0:
        logger.error(f"User \"{current_user['username']}\" upload failed: File is empty (0 bytes)")
        return jsonify({'error': 'File is empty'}), 400
    
    if file_length > max_size:
        logger.error(f"User \"{current_user['username']}\" attempted to upload a file larger than 3MB")
        return jsonify({'error': 'File size exceeds 3MB limit'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{file.filename}")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
    # File Validation (Backend)
        try:
            with Image.open(filepath) as img:
                img.verify()  
            
        except (UnidentifiedImageError, ValueError, OSError):
            os.remove(filepath)
            logger.error(f"User \"{current_user['username']}\" uploaded an invalid or corrupted image (.JPEG, .JPG, .PNG) file")
            return jsonify({'error': 'Invalid or Corrupted Image file'}), 400

        db = get_db()
        cursor = db.cursor()
        cursor.execute("UPDATE users SET profile_pic = %s WHERE user_id = %s", (filename, current_user['user_id']))
        db.commit()
        logger.info(f"User \"{current_user['username']}\" uploaded a new profile image!")
        
        return jsonify({
            'message': 'Profile image uploaded successfully!',
            'filename': filename  # or whatever variable holds the filename
        }), 200

@profile_bp.route('/profile-image/<filename>')
def get_profile_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)