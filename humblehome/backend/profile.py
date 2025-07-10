from flask import Blueprint, request, jsonify, send_from_directory
import os
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db
from middleware import token_req
from PIL import Image, UnidentifiedImageError
from auth import is_password_complex
import logging

logger = logging.getLogger("humblehome_logger")  # Custom logger
profile_bp = Blueprint("profile", __name__)

UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads", "images")
ALLOWED_EXTS = {"png", "jpg", "jpeg", "gif"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTS


@profile_bp.route("/update-profile", methods=["PUT"])
@token_req
def updateProfile(current_user):
    data = request.json
    fullname = data["fullname"]
    phonenumber = data["phonenumber"]
    address = data["address"]

    # Normalize values for comparison (handle None vs empty string)
    current_fullname = current_user.get("full_name") or ""
    current_phonenumber = current_user.get("phone_number") or ""
    current_address = current_user.get("address") or ""

    # Check which fields have been updated before making database changes
    updated_fields = []
    update_values = []
    update_columns = []

    if fullname != current_fullname:
        updated_fields.append("full_name")
        update_columns.append("full_name = %s")
        update_values.append(fullname)

    if phonenumber != current_phonenumber:
        updated_fields.append("phone_number")
        update_columns.append("phone_number = %s")
        update_values.append(phonenumber)

    if address != current_address:
        updated_fields.append("address")
        update_columns.append("address = %s")
        update_values.append(address)

    if updated_fields:
        db = get_db()
        cursor = db.cursor()

        # Only update the fields that actually changed
        update_query = f"""UPDATE users SET {', '.join(update_columns)}
        WHERE user_id = %s"""
        update_values.append(current_user["user_id"])

        cursor.execute(update_query, update_values)
        db.commit()

        logger.info(
            f"""User \"{current_user['username']}\"
                    updated their profile successfully!
                    -- Fields Updated: {', '.join(updated_fields)}"""
        )
        return jsonify({"message": "Profile updated successfully"}), 200
    else:
        logger.info(
            f"""User "{current_user["username"]}"
                    submitted profile update with no changes."""
        )
        return jsonify({"message": "No changes detected"}), 200


@profile_bp.route("/upload-profile-image", methods=["POST"])
@token_req
def upload_pic(current_user):
    logger.info(f"User \"{current_user['username']}\" initiated profile image upload")

    if "image" not in request.files:
        logger.error(
            f"""User \"{current_user['username']}\"
                     upload failed: No file is being uploaded"""
        )
        return jsonify({"error": "No image part in req"}), 400

    file = request.files["image"]

    # Check if file is None or has no filename
    if file is None:
        logger.error(
            f"""User \"{current_user['username']}\"
                     upload failed: File is null"""
        )
        return jsonify({"error": "No file provided"}), 400

    if file.filename == "" or file.filename is None:
        logger.error(
            f"""User \"{current_user['username']}\" upload failed:
                     No file submitted or empty filename"""
        )
        return jsonify({"error": "No file submitted"}), 400

    # Check file size (3MB limit)
    max_size = 3 * 1024 * 1024  # 3MB in bytes
    file.seek(0, os.SEEK_END)  # Move cursor to end of file
    file_length = file.tell()  # Get file size
    file.seek(0)  # Reset cursor position

    # Check if file is completely empty (0 bytes)
    if file_length == 0:
        logger.error(
            f"""User \"{current_user['username']}\"
                     upload failed: File is empty (0 bytes)"""
        )
        return jsonify({"error": "File is empty. Please re-upload another file."}), 400

    if file_length > max_size:
        logger.error(
            f"""User \"{current_user['username']}\"
                     attempted to upload a file larger than 3MB"""
        )
        return jsonify({"error": "File size exceeds the maximum limit of 3MB."}), 400

    if allowed_file(file.filename):
        filename = secure_filename(f"{file.filename}")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        # File Validation (Backend)
        try:
            with Image.open(filepath) as img:
                img.verify()

        except (UnidentifiedImageError, ValueError, OSError):
            os.remove(filepath)
            logger.error(
                f"""User \"{current_user['username']}\"
                         attempted to
                         upload an invalid or corrupted image
                         (.JPEG, .JPG, .PNG) file"""
            )
            return jsonify({"error": "Invalid or Corrupted Image file"}), 400

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            """UPDATE users SET profile_pic = %s WHERE user_id = %s""",
            (filename, current_user["user_id"]),
        )
        db.commit()
        logger.info(
            f"""User \"{current_user['username']}\"
                    uploaded a new profile image!"""
        )

        return (
            jsonify(
                {
                    "message": "Profile image uploaded successfully!",
                    "filename": filename,  # or whatever variable holds the filename
                }
            ),
            200,
        )
    else:
        logger.error(
            f"""User \"{current_user['username']}\"
                     upload failed: Invalid file type -- {file.filename}"""
        )
        return (
            jsonify(
                {
                    "error": """Invalid file type.
                        Only .JPEG, .JPG, .PNG files are allowed."""
                }
            ),
            400,
        )


@profile_bp.route("/profile-image/<filename>")
def get_profile_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@profile_bp.route("/change-password", methods=["PUT"])
@token_req
def change_password(current_user):
    data = request.json

    # Validate required fields
    required_fields = ["currentPassword", "newPassword", "confirmPassword"]
    if not all(field in data for field in required_fields):
        logger.error(
            f"""User \"{current_user['username']}\"
                     password change failed: Missing required fields"""
        )
        return jsonify({"error": "All password fields are required"}), 400

    current_password = data["currentPassword"]
    new_password = data["newPassword"]
    confirm_password = data["confirmPassword"]

    # Basic validation
    if not current_password or not new_password or not confirm_password:
        logger.error(
            f"""User \"{current_user['username']}\"
                     password change failed: Empty password fields"""
        )
        return jsonify({"error": "Password fields cannot be empty"}), 400

    if new_password != confirm_password:
        logger.error(
            f"""User \"{current_user['username']}\"
                     password change failed: New passwords don't match"""
        )
        return jsonify({"error": "New password and confirmation do not match"}), 400

    if not is_password_complex(new_password):
        logger.error(
            f"""User \"{current_user['username']}\"
                     password change failed, password complexity not met"""
        )
        return (
            jsonify(
                {
                    "error": """Password must be at least 8 characters long and
                        include 1 uppercase letter,
                        1 number, and 1 special character."""
                }
            ),
            400,
        )

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT password_hash FROM users WHERE user_id = %s", (current_user["user_id"],)
    )
    user = cursor.fetchone()

    if not user or not check_password_hash(user["password_hash"], current_password):
        logger.error(
            f"""User \"{current_user['username']}\"
                     password change failed: Incorrect current password"""
        )
        return jsonify({"error": "Current password is incorrect"}), 401

    hashed_password = generate_password_hash(new_password)
    cursor.execute(
        "UPDATE users SET password_hash = %s WHERE user_id = %s",
        (hashed_password, current_user["user_id"]),
    )
    db.commit()

    logger.info(
        f"""User \"{current_user['username']}\"
                successfully changed their password"""
    )
    return jsonify({"message": "Password changed successfully"}), 200


@profile_bp.route("/my-reviews", methods=["GET"])
@token_req
def get_my_reviews(current_user):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        # Get pagination parameters
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 5))
        offset = (page - 1) * per_page

        # Get total reviews count
        cursor.execute(
            """
            SELECT COUNT(*) AS total_reviews
            FROM reviews
            WHERE user_id = %s
        """,
            (current_user["user_id"],),
        )
        total_reviews = cursor.fetchone()["total_reviews"]
        total_pages = (total_reviews + per_page - 1) // per_page

        # Get paginated reviews
        cursor.execute(
            """
            SELECT r.id, r.product_id, r.text, r.rating,
            r.created_at, p.name AS product_name
            FROM reviews r
            JOIN products p ON r.product_id = p.id
            WHERE r.user_id = %s
            ORDER BY r.created_at DESC
            LIMIT %s OFFSET %s
        """,
            (current_user["user_id"], per_page, offset),
        )
        reviews = cursor.fetchall()

        return (
            jsonify(
                {
                    "reviews": reviews,
                    "page": page,
                    "per_page": per_page,
                    "total_reviews": total_reviews,
                    "total_pages": total_pages,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
