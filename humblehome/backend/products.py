from flask import request, jsonify, current_app, Blueprint, send_from_directory
from functools import wraps
from middleware import token_req
from db import get_db
from werkzeug.utils import secure_filename
import os
import json

secretkey = 'supersecretkey'
products_bp = Blueprint('products', __name__)
ALLOWED_EXTENSIONS = {'stl'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def is_valid_stl(file_stream):
    try:
        header = file_stream.read(6).decode('ascii', errors='ignore')
        file_stream.seek(0)  
    
        if header.lower().startswith('solid'):
            return True

        if len(file_stream.read()) >= 84:
            file_stream.seek(0)
            return True
            
        return False
    except:
        return False
    

@products_bp.route('/api/uploads/images/<filename>')
def serve_image_file(filename):
    return send_from_directory('uploads/images', filename)

@products_bp.route('/api/uploads/models/<filename>')
def serve_model_file(filename):
    return send_from_directory('uploads/models', filename)

@products_bp.route('/api/admin/add_product', methods=['POST'])
@token_req
def add_product(current_user):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    name = request.form.get('name')
    price = request.form.get('price')
    description = request.form.get('description')
    category = request.form.get('category')
    stock = request.form.get('stock')
    
    model_file = request.files.get('model_file')
    image_files = request.files.getlist('images')  # multiple images input
    thumbnail_file = request.files.get('thumbnail')
    
    upload_models_folder = "uploads/models"
    upload_images_folder = "uploads/images"
    
    # Ensure directories exist
    os.makedirs(upload_models_folder, exist_ok=True)
    os.makedirs(upload_images_folder, exist_ok=True)
    
    # Validate all files submitted
    if not all([name, price, description, category, stock, model_file]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Validate model file
    if model_file.filename == '' or not allowed_file(model_file.filename):
        return jsonify({"error": "Invalid or missing model file"}), 400
    
    # Check STL file content
    if not is_valid_stl(model_file.stream):
        return jsonify({"error": "Invalid STL file content"}), 400
    
    model_file.seek(0)  
    
    model_filename = secure_filename(model_file.filename)
    model_path = os.path.join(upload_models_folder, model_filename)
    model_file.save(model_path)
    
    # Save thumbnail image
    thumbnail_filename = f"thumb_{secure_filename(thumbnail_file.filename)}"
    thumbnail_path = os.path.join(upload_images_folder, thumbnail_filename)
    thumbnail_file.save(thumbnail_path)
    
    # Insert product
    cursor.execute(
        "INSERT INTO products (name, model_file, price, description, stock, thumbnail_image) VALUES (%s, %s, %s, %s, %s, %s)",
        (name, model_path, price, description, stock, thumbnail_path)
    )
    product_id = cursor.lastrowid
    
    # Save product images
    for i, image in enumerate(image_files):
        if image and image.filename != '':
            image_filename = f"{product_id}_{i}_" + secure_filename(image.filename)
            image_path = os.path.join(upload_images_folder, image_filename)
            image.save(image_path)

            cursor.execute(
                "INSERT INTO product_images (product_id, image_url, alt_text, sort_order) VALUES (%s, %s, %s, %s)",
                (product_id, image_path, image.filename, i)
            )
    
    cursor.execute("SELECT id from category WHERE name = %s", (category,))
    cat_id = cursor.fetchone()['id']
    if not cat_id:
        return jsonify({"error": "Invalid file format"}), 400   
    
    # Insert into category_products
    cursor.execute("INSERT into category_products (product_id, category_id) VALUES (%s, %s)", (product_id, cat_id))  
    db.commit()
     
    return jsonify({
        "message": "Product added successfully",
        "product_id": product_id,
        "thumbnail": thumbnail_path,
        "model_file": model_path
    }), 200

@products_bp.route('/api/products', methods=['get'])
def get_products():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT 
        p.*, 
        ANY_VALUE(c.name) AS category,
        GROUP_CONCAT(pi.image_url ORDER BY pi.sort_order) AS images
        FROM products p
        LEFT JOIN category_products cp ON p.id = cp.product_id
        LEFT JOIN category c ON cp.category_id = c.id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        GROUP BY p.id;
    """)
    products = cursor.fetchall()
    
    for product in products:
        if product['images']:
            product['images'] = product['images'].split(',')  # Convert CSV string to array
        else:
            product['images'] = [] 
    
    return jsonify(products), 200    

@products_bp.route('/products/active', methods=['get'])
def get_active_products():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    cursor.execute("""
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
    """)
    products = cursor.fetchall()
    
    for product in products:
        if product['images']:
            product['images'] = product['images'].split(',')  # Convert CSV string to array
        else:
            product['images'] = [] 
    
    return jsonify(products), 200    

@products_bp.route('/api/categories', methods = ['GET'])
def get_categories():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM category")
    categories = cursor.fetchall()
    
    return jsonify(categories), 200    

@products_bp.route('/api/admin/api/update_product/<int:product_id>', methods = ['PUT'])
@token_req
def update_product(current_user, product_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    name = request.form.get('name')
    price = request.form.get('price')
    description = request.form.get('description')
    stock = request.form.get('stock')
    status = request.form.get('status')
    category = request.form.get('category')
    thumbnail = request.files.get('thumbnail')
    
    # Images
    existing_images_order = request.form.get('existing_images_order')
    new_images = request.files.getlist('images')  # List of new images

    fields = []
    values = []

    if name: fields.append("name = %s"); values.append(name)
    if price: fields.append("price = %s"); values.append(price)
    if description: fields.append("description = %s"); values.append(description)
    if stock: fields.append("stock = %s"); values.append(stock)
    if status: fields.append("status = %s"); values.append(status)

    if fields:
        values.append(product_id)
        cursor.execute(f"UPDATE products SET {', '.join(fields)} WHERE id = %s", values)

    # Category update
    if category:
        cursor.execute("SELECT id FROM category WHERE name = %s", (category,))
        cat = cursor.fetchone()
        if not cat:
            return jsonify({"error": "Category not found"}), 404
        cat_id = cat['id']
        cursor.execute("DELETE FROM category_products WHERE product_id = %s", (product_id,))
        cursor.execute("INSERT INTO category_products (product_id, category_id) VALUES (%s, %s)", (product_id, cat_id))

    if thumbnail:
        thumbnail_filename = f"thumb_{secure_filename(thumbnail.filename)}"
        thumbnail_path = os.path.join("uploads/images", thumbnail_filename)
        thumbnail.save(thumbnail_path)
        cursor.execute(
            "UPDATE products SET thumbnail_image = %s WHERE id = %s",
            (thumbnail_path, product_id)
        )
    
    if existing_images_order:
        try:
            existing_images_order = json.loads(existing_images_order)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid image order JSON"}), 400

        cursor.execute("SELECT image_url FROM product_images WHERE product_id = %s", (product_id,))
        current_images = {img['image_url'] for img in cursor.fetchall()}

        # Delete images not in the updated list
        for img in current_images - set(existing_images_order):
            os.remove(os.path.join("uploads/images", os.path.basename(img)))
            cursor.execute("DELETE FROM product_images WHERE product_id = %s AND image_url = %s", (product_id, img))

        # Update sort_order for remaining images
        for index, image_url in enumerate(existing_images_order):
            cursor.execute("""
                UPDATE product_images SET sort_order = %s
                WHERE product_id = %s AND image_url = %s
            """, (index, product_id, image_url))
    
    
    cursor.execute("SELECT COALESCE(MAX(sort_order), 0) FROM product_images WHERE product_id = %s", (product_id,))
    max_sort_order = cursor.fetchone()
    next_sort_order = max_sort_order['COALESCE(MAX(sort_order), 0)'] + 1 if max_sort_order else 1

    # Add New Images
    for image in new_images:
        filename = secure_filename(image.filename)
        path = os.path.join("uploads/images", filename)
        image.save(path)
        
        cursor.execute("""
            INSERT INTO product_images (product_id, image_url, sort_order)
            VALUES (%s, %s, %s)
        """, (product_id, path, next_sort_order))
        
        next_sort_order += 1  # increment for next image

    db.commit()
    return jsonify({"message": "Product updated successfully"}), 200

@products_bp.route('/api/admin/api/add_category', methods = ['POST'])
def add_category():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    cat_name = request.form.get('name')
    
    cursor.execute("INSERT INTO category (name) VALUES (%s)", (cat_name,))
    db.commit()
    return jsonify({"message": "Category added successfully"}), 200

@products_bp.route('/api/categories_with_count', methods=['GET'])
def get_categories_with_count():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT c.id, c.name, COUNT(cp.product_id) AS product_count
        FROM category c
        LEFT JOIN category_products cp ON c.id = cp.category_id
        GROUP BY c.id, c.name
        ORDER BY c.name
    """)
    categories = cursor.fetchall()
    return jsonify(categories), 200

@products_bp.route('/api/search', methods = ['GET'])
def search():
    query = request.args.get('q', '').strip()
    
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