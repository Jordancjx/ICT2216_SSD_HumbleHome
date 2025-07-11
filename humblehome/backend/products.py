from flask import request, jsonify, Blueprint, send_from_directory
from middleware import token_req
from db import get_db
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError
import os
import json
import logging
import re

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

logger = logging.getLogger("humblehome_logger")  # Custom logger
secretkey = "supersecretkey"
products_bp = Blueprint("products", __name__)
ALLOWED_EXTENSIONS = {"stl"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def is_valid_stl(file_stream):
    try:
        header = file_stream.read(6).decode("ascii", errors="ignore")
        file_stream.seek(0)

        if header.lower().startswith("solid"):
            return True

        if len(file_stream.read()) >= 84:
            file_stream.seek(0)
            return True

        return False
    except Exception:
        return False


def allowed_image_file(filename):
    return filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))


def validate_image_file(file):
    # Check extension
    if not allowed_image_file(file.filename):
        return False, "Invalid file extension"
    # Check size
    file.seek(0, os.SEEK_END)
    if file.tell() > MAX_IMAGE_SIZE:
        return False, "File too large (max 3MB)"
    file.seek(0)
    # Check content
    try:
        with Image.open(file) as img:
            img.verify()
    except (UnidentifiedImageError, ValueError, OSError):
        return False, "Invalid or corrupted image file"
    file.seek(0)
    return True, None


@products_bp.route("/uploads/images/<filename>")
def serve_image_file(filename):
    return send_from_directory("uploads/images", filename)


@products_bp.route("/uploads/models/<filename>")
def serve_model_file(filename):
    return send_from_directory("uploads/models", filename)


@products_bp.route("/admin/add_product", methods=["POST"])
@token_req
def add_product(current_user):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    name = request.form.get("name")
    price = request.form.get("price")
    description = request.form.get("description")
    category = request.form.get("category")
    stock = request.form.get("stock")
    model_file = request.files.get("model_file")
    image_files = request.files.getlist("images")  # multiple images input
    thumbnail_file = request.files.get("thumbnail")
    upload_models_folder = "uploads/models"
    upload_images_folder = "uploads/images"

    # Ensure directories exist
    os.makedirs(upload_models_folder, exist_ok=True)
    os.makedirs(upload_images_folder, exist_ok=True)
    

    # Validate all files submitted
    if not all([name, price, description, category, stock, model_file]):
        return jsonify({"error": "Missing required fields"}), 400

    # Validate model file
    if model_file.filename == "" or not allowed_file(model_file.filename):
        return jsonify({"error": "Invalid or missing model file"}), 400

    # Check STL file content
    if not is_valid_stl(model_file.stream):
        return jsonify({"error": "Invalid STL file content"}), 400

    model_file.seek(0)
    model_filename = secure_filename(model_file.filename)
    model_path = os.path.join(upload_models_folder, model_filename)
    model_file.save(model_path)

    for image in image_files:
        valid, error = validate_image_file(image)
        if not valid:
            return jsonify({"error": f"Image {image.filename}: {error}"}), 400
        filename = secure_filename(image.filename)
        image_path = os.path.join(upload_images_folder, filename)
        image.save(image_path)

    valid, error = validate_image_file(thumbnail_file)
    if not valid:
        return jsonify({"error": f"Thumbnail: {error}"}), 400

    # Save thumbnail image
    thumbnail_filename = f"thumb_{secure_filename(thumbnail_file.filename)}"
    thumbnail_path = os.path.join(upload_images_folder, thumbnail_filename)
    thumbnail_file.save(thumbnail_path)

    # Insert product
    cursor.execute(
        """INSERT INTO products (name, model_file, price,
        description, stock, thumbnail_image)
        VALUES (%s, %s, %s, %s, %s, %s)""",
        (name, model_path, price, description, stock, thumbnail_path),
    )
    logger.info(
        f"""New Product added! -- \"{name}\" by user
                \"{current_user['username']}\""""
    )
    product_id = cursor.lastrowid

    # Save product images
    for i, image in enumerate(image_files):
        if image and image.filename != "":
            image_filename = f"{product_id}_{i}_" + secure_filename(image.filename)
            image_path = os.path.join(upload_images_folder, image_filename)
            image.save(image_path)

            cursor.execute(
                """INSERT INTO product_images (product_id, image_url,
                alt_text, sort_order)
                VALUES (%s, %s, %s, %s)""",
                (product_id, image_path, image.filename, i),
            )
            logger.info(
                f"""Image {image_filename} uploaded for product
                        \"{name}\" by user \"{current_user['username']}\"."""
            )

    cursor.execute("SELECT id from category WHERE name = %s", (category,))
    cat_id = cursor.fetchone()["id"]
    if not cat_id:
        return jsonify({"error": "Invalid file format"}), 400

    # Insert into category_products
    cursor.execute(
        """INSERT into category_products (product_id, category_id)
                   VALUES (%s, %s)""",
        (product_id, cat_id),
    )
    logger.info(
        f"""Product \"{name}\" added to category \"{category}\"
                by user \"{current_user['username']}\". """
    )
    db.commit()

    return (
        jsonify(
            {
                "message": "Product added successfully",
                "product_id": product_id,
                "thumbnail": thumbnail_path,
                "model_file": model_path,
            }
        ),
        200,
    )


@products_bp.route("/products", methods=["get"])
def get_products():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
        p.*,
        ANY_VALUE(c.name) AS category,
        GROUP_CONCAT(pi.image_url ORDER BY pi.sort_order) AS images
        FROM products p
        LEFT JOIN category_products cp ON p.id = cp.product_id
        LEFT JOIN category c ON cp.category_id = c.id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        GROUP BY p.id;
    """
    )
    products = cursor.fetchall()

    for product in products:
        if product["images"]:
            product["images"] = product["images"].split(",")
        else:
            product["images"] = []

    return jsonify(products), 200


@products_bp.route("/products/active", methods=["get"])
def get_active_products():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
        p.*,
        ANY_VALUE(c.name) AS category,
        GROUP_CONCAT(pi.image_url ORDER BY pi.sort_order) AS images
        FROM products p
        LEFT JOIN category_products cp ON p.id = cp.product_id
        LEFT JOIN category c ON cp.category_id = c.id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.status = 'active'
        GROUP BY p.id
    """
    )
    products = cursor.fetchall()

    for product in products:
        if product["images"]:
            product["images"] = product["images"].split(",")
        else:
            product["images"] = []

    return jsonify(products), 200


@products_bp.route("/categories", methods=["GET"])
def get_categories():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM category")
    categories = cursor.fetchall()

    return jsonify(categories), 200


@products_bp.route("/admin/api/update_product/<int:product_id>", methods=["PUT"])
@token_req
def update_product(current_user, product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    name = request.form.get("name")
    price = request.form.get("price")
    description = request.form.get("description")
    stock = request.form.get("stock")
    status = request.form.get("status")
    category = request.form.get("category")
    thumbnail = request.files.get("thumbnail")

    # Images
    existing_images_order = request.form.get("existing_images_order")
    new_images = request.files.getlist("images")  # List of new images

    fields = []
    values = []

    if name:
        fields.append("name = %s")
        values.append(name)

    if price:
        fields.append("price = %s")
        values.append(price)

    if description:
        fields.append("description = %s")
        values.append(description)

    if stock:
        fields.append("stock = %s")
        values.append(stock)

    if status:
        fields.append("status = %s")
        values.append(status)

    if fields:
        values.append(product_id)
        cursor.execute(f"UPDATE products SET {', '.join(fields)} WHERE id = %s", values)
        logger.info(
            f"""Product \"{name}\"details updated by user
                    \"{current_user['username']}\".
                    -- Fields Updated:
                    {', '.join(fields)}"""
        )

    # Category update
    if category:
        cursor.execute("SELECT id FROM category WHERE name = %s", (category,))
        cat = cursor.fetchone()
        if not cat:
            return jsonify({"error": "Category not found"}), 404
        cat_id = cat["id"]
        cursor.execute(
            """DELETE FROM category_products
                       WHERE product_id = %s""",
            (product_id,),
        )
        cursor.execute(
            """INSERT INTO category_products
                       (product_id, category_id)
                       VALUES (%s, %s)""",
            (product_id, cat_id),
        )
        logger.info(
            f"""Product \"{name}\" updated to category \"{category}\"
                    by user \"{current_user['username']}\"."""
        )

    if thumbnail:
        valid, error = validate_image_file(thumbnail)
        if not valid:
            return jsonify({"error": f"Thumbnail: {error}"}), 400
        thumbnail_filename = f"thumb_{secure_filename(thumbnail.filename)}"
        thumbnail_path = os.path.join("uploads/images", thumbnail_filename)
        thumbnail.save(thumbnail_path)
        cursor.execute(
            "UPDATE products SET thumbnail_image = %s WHERE id = %s",
            (thumbnail_path, product_id),
        )

        logger.info(
            f"""Thumbnail image updated for product \"{name}\"
                    by user \"{current_user['username']}\"."""
        )

    if existing_images_order:
        try:
            existing_images_order = json.loads(existing_images_order)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid image order JSON"}), 400

        cursor.execute(
            """SELECT image_url FROM product_images
                       WHERE product_id = %s""",
            (product_id,),
        )
        current_images = {img["image_url"] for img in cursor.fetchall()}

        # Delete images not in the updated list
        for img in current_images - set(existing_images_order):
            os.remove(os.path.join("uploads/images", os.path.basename(img)))
            cursor.execute(
                """DELETE FROM product_images WHERE product_id = %s
                           AND image_url = %s""",
                (product_id, img),
            )
            logger.info(
                f"""Image(s) {img} removed for product due to update \"{name}\"
                        by user \"{current_user['username']}\"."""
            )

        # Update sort_order for remaining images
        for index, image_url in enumerate(existing_images_order):
            cursor.execute(
                """
                UPDATE product_images SET sort_order = %s
                WHERE product_id = %s AND image_url = %s
            """,
                (index, product_id, image_url),
            )
            logger.info(
                f"""Image sort order updated for product \"{name}\"
                        by user \"{current_user['username']}\"."""
            )

    cursor.execute(
        """SELECT COALESCE(MAX(sort_order), 0) FROM product_images
                   WHERE product_id = %s""",
        (product_id,),
    )
    max_sort_order = cursor.fetchone()
    next_sort_order = max_sort_order["""COALESCE(MAX(sort_order), 0)"""]
    +1 if max_sort_order else 1

    # Add New Images
    for image in new_images:
        valid, error = validate_image_file(image)
        if not valid:
            return jsonify({"error": f"New image {image.filename}: {error}"}), 400

        filename = secure_filename(image.filename)
        path = os.path.join("uploads/images", filename)
        image.save(path)

        cursor.execute(
            """
            INSERT INTO product_images (product_id, image_url, sort_order)
            VALUES (%s, %s, %s)""",
            (product_id, path, next_sort_order),
        )

        next_sort_order += 1  # increment for next image
        logger.info(
            f"""New image {filename} added for product \"{name}\"
                    by user \"{current_user['username']}\"."""
        )

    db.commit()
    logger.info(
        f"""Product \"{name}\" updated successfully by user
                \"{current_user['username']}\"."""
    )
    return jsonify({"message": "Product updated successfully"}), 200


@products_bp.route("/admin/api/add_category", methods=["POST"])
def add_category():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cat_name = request.form.get("name")
    cursor.execute("INSERT INTO category (name) VALUES (%s)", (cat_name,))
    logger.info(f'New Category added! -- "{cat_name}"')
    db.commit()
    return jsonify({"message": "Category added successfully"}), 200


@products_bp.route("/categories_with_count", methods=["GET"])
def get_categories_with_count():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT c.id, c.name, COUNT(cp.product_id) AS product_count
        FROM category c
        LEFT JOIN category_products cp ON c.id = cp.category_id
        GROUP BY c.id, c.name
        ORDER BY c.name
    """
    )
    categories = cursor.fetchall()
    return jsonify(categories), 200


@products_bp.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify([])

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        sql = "SELECT * FROM products WHERE name LIKE %s LIMIT 20"
        cursor.execute(sql, (f"%{query}%",))
        results = cursor.fetchall()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        db.close()


@products_bp.route("/products/<int:product_id>/reviews", methods=["POST"])
@token_req
def add_product_review(current_user, product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        rating = data.get("rating")
        text = data.get("comment", "").strip()
        name = current_user.get("username")

        # Validate rating
        if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
            return jsonify({"error": "Rating must be between 1 and 5"}), 400

        # Validate comment
        if len(text) < 5 or len(text) > 500:
            return jsonify({"error": "Comment must be 5–500 characters."}), 400

        # Sanitize comment (basic: strip < >)
        text = re.sub(r"[<>]", "", text)

        # Check if user already reviewed this product
        cursor.execute(
            """
            SELECT id FROM reviews
            WHERE product_id = %s AND user_id = %s
        """,
            (product_id, current_user["user_id"]),
        )

        if cursor.fetchone():
            return jsonify({"error": "You have already reviewed this product"}), 400

        # Insert review
        cursor.execute(
            """
            INSERT INTO reviews (product_id, user_id, rating, `text`, name)
            VALUES (%s, %s, %s, %s, %s)
        """,
            (product_id, current_user["user_id"], rating, text, name),
        )

        db.commit()

        return (
            jsonify(
                {"message": "Review added successfully", "review_id": cursor.lastrowid}
            ),
            201,
        )

    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()


@products_bp.route("/products/<int:product_id>/reviews", methods=["GET"])
def get_product_reviews(product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        # Get pagination parameters from query string
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 6))  # Default to 5 reviews per page
        offset = (page - 1) * per_page

        # Sorting Options
        sort_by = request.args.get("sort", "date")  # default = date
        order_clause = "ORDER BY r.created_at DESC"

        if sort_by == "rating":
            order_clause = "ORDER BY r.rating DESC"

        # Get reviews with user information
        cursor.execute(
            f"""
            SELECT r.id, r.rating, r.`text`, r.created_at, r.name,
            u.username, u.profile_pic
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.product_id = %s
            {order_clause}
            LIMIT %s OFFSET %s
        """,
            (product_id, per_page, offset),
        )
        reviews = cursor.fetchall()

        # Get total number of reviews for pagination info
        cursor.execute(
            """
            SELECT COUNT(*) as total_reviews FROM reviews WHERE product_id = %s
        """,
            (product_id,),
        )
        total_reviews = cursor.fetchone()["total_reviews"]
        total_pages = (total_reviews + per_page - 1) // per_page

        return (
            jsonify(
                {
                    "reviews": reviews,
                    "total_reviews": total_reviews,
                    "page": page,
                    "per_page": per_page,
                    "total_pages": total_pages,
                }
            ),
            200,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()


@products_bp.route("/products/<int:product_id>/reviews/stats", methods=["GET"])
def get_review_stats(product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        # Get review statistics
        cursor.execute(
            """
            SELECT
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM reviews
            WHERE product_id = %s
        """,
            (product_id,),
        )

        stats = cursor.fetchone()

        if not stats["total_reviews"]:
            return jsonify({"error": "No reviews found for this product"}), 404

        # Convert decimal to float for JSON serialization
        stats["average_rating"] = float(stats["average_rating"])

        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()


@products_bp.route("/reviews/<int:review_id>", methods=["DELETE"])
@token_req
def delete_review(current_user, review_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT user_id FROM reviews WHERE id = %s", (review_id,))
        review = cursor.fetchone()
        if not review:
            return jsonify({"error": "Review not found"}), 404

        if review["user_id"] != current_user["user_id"]:
            return jsonify({"error": "Unauthorized"}), 403

        cursor.execute("DELETE FROM reviews WHERE id = %s", (review_id,))
        db.commit()

        return jsonify({"message": "Review deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()


@products_bp.route("/products/<int:product_id>", methods=["GET"])
def fetch_product(product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT * FROM products WHERE id = %s
                   AND status = 'active'""",
        (product_id,),
    )
    product = cursor.fetchone()

    cursor.execute(
        """SELECT image_url FROM product_images
                   WHERE product_id = %s""",
        (product_id,),
    )
    images = cursor.fetchall()  # [{'image_url': 'path1'}, {'image_url': 'path2'}, ...]
    product["images"] = [img["image_url"] for img in images]

    if not product:
        return jsonify({"error": "Product not found or is inactive."}), 404

    return jsonify(product)


@products_bp.route("/api/admin/delete_product/<int:product_id>", methods=["DELETE"])
@token_req
def delete_product(current_user, product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """SELECT image_url FROM product_images
                       WHERE product_id = %s""",
            (product_id,),
        )
        image_paths = [row["image_url"] for row in cursor.fetchall()]

        cursor.execute(
            """DELETE FROM product_images
                       WHERE product_id = %s""",
            (product_id,),
        )

        cursor.execute("DELETE FROM products WHERE id = %s", (product_id,))

        db.commit()

        import os

        for path in image_paths:
            try:
                os.remove(path)
            except Exception as e:
                print(f"Failed to delete {path}: {e}")

        return (
            jsonify({"message": "Product and related images deleted successfully"}),
            200,
        )

    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to delete product: {str(e)}"}), 500


@products_bp.route("/api/admin/update_order_status/<int:order_id>", methods=["PUT"])
@token_req
def update_order_status(current_user, order_id):
    new_status = request.json.get("status")
    valid_statuses = ["pending", "shipped", "delivered", "cancelled"]

    if new_status not in valid_statuses:
        return jsonify({"error": "Invalid status value"}), 400

    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute(
            "UPDATE orders SET status = %s WHERE order_id = %s", (new_status, order_id)
        )
        db.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "Order not found"}), 404

        return jsonify({"message": "Order status updated"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()


@products_bp.route("/api/admin/orders", methods=["GET"])
@token_req
def get_orders(current_user):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                o.order_id,
                u.username,
                o.order_date,
                o.status,
                o.total_amount,
                o.shipping_address,
                o.payment_method
            FROM orders o
            JOIN users u ON o.user_id = u.user_id
            ORDER BY o.order_date DESC
        """
        )
        orders = cursor.fetchall()
        return jsonify(orders), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
