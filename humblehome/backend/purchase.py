from flask import request, jsonify, Blueprint
from middleware import token_req
from db import get_db
from werkzeug.exceptions import BadRequest
import logging
import re

logger = logging.getLogger("humblehome_logger")  # Custom logger


def clean_text(text):
    return re.sub(r"[<>]", "", text)


purchases_bp = Blueprint("purchases", __name__)


def is_valid_cart(cart):
    if not isinstance(cart, list):
        return False
    for item in cart:
        if not all(k in item for k in ["product_id", "quantity", "price"]):
            return False
        if not isinstance(item["product_id"], int) or item["product_id"] <= 0:
            return False
        if not isinstance(item["quantity"], int) or item["quantity"] <= 0:
            return False
        if not isinstance(item["price"], (int, float)) or item["price"] < 0:
            return False
    return True


@purchases_bp.route("/checkout", methods=["POST"])
@token_req
def checkout(current_user):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        data = request.get_json(force=True)
        logger.info(f"Checkout initiated by \"{current_user['username']}\".")
        user_id = current_user["user_id"]
        cart = data.get("cart")
        shipping_address = data.get("shipping_address")
        payment_method = data.get("payment_method")

        # Input validation
        if not isinstance(user_id, int):
            raise BadRequest("Invalid customer ID.")
        if not is_valid_cart(cart):
            raise BadRequest("Invalid cart format.")
        if not isinstance(shipping_address, str) or not shipping_address.strip():
            raise BadRequest("Invalid address.")
        if payment_method not in ["card", "paypal"]:
            raise BadRequest("Invalid payment method.")

        total_amount = sum(item["quantity"] * item["price"] for item in cart)

        cursor.execute(
            """
            INSERT INTO orders (user_id, order_date, status, total_amount,
            shipping_address, payment_method)
            VALUES (%s, NOW(), %s, %s, %s, %s)
        """,
            (user_id, "pending", total_amount, shipping_address, payment_method),
        )

        logger.info(f"Order created for user \"{current_user['username']}\".")
        order_id = cursor.lastrowid

        for item in cart:
            cursor.execute(
                """
                INSERT INTO order_items
                (order_id, product_id, quantity, price_at_purchase)
                VALUES (%s, %s, %s, %s)
            """,
                (order_id, item["product_id"], item["quantity"], item["price"]),
            )

        logger.info(f"Order items added to \"{current_user['username']}\" order.")

        db.commit()

        return (
            jsonify(
                {
                    "message": "Order placed successfully",
                    "order_id": order_id,
                    "total_amount": total_amount,
                }
            ),
            201,
        )

    except BadRequest as e:
        logger.error(
            f"""Checkout failed for user \"
                     {current_user['username']}\": {str(e)}"""
        )
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(
            f"""Checkout error for user \"
                     {current_user['username']}\": {str(e)}"""
        )
        db.rollback()
        return jsonify({"error": "Something went wrong during checkout"}), 500


@purchases_bp.route("/purchase-history", methods=["GET"])
@token_req
def get_purchase_history(current_user):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT o.order_id AS order_id, o.order_date, o.status, o.total_amount,
               oi.product_id, p.name AS product_name, oi.quantity, oi.price_at_purchase
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = %s
        ORDER BY o.order_date DESC
    """,
        (current_user["user_id"],),
    )

    rows = cursor.fetchall()

    orders = {}
    for row in rows:
        order_id = row["order_id"]
        item = {
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "quantity": row["quantity"],
            "price_at_purchase": float(row["price_at_purchase"]),
        }

        if order_id not in orders:
            orders[order_id] = {
                "order_id": order_id,
                "order_date": row["order_date"],
                "status": row["status"],
                "total_amount": float(row["total_amount"]),
                "items": [item],
            }
        else:
            orders[order_id]["items"].append(item)

    return jsonify(list(orders.values())), 200


@purchases_bp.route("/enquiries", methods=["POST"])
@token_req
def create_enquiry(current_user):
    data = request.get_json()
    db = get_db()
    cursor = db.cursor()

    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()
    product_id = data.get("product_id")
    order_id = data.get("order_id")

    if not (3 <= len(subject) <= 100):
        return jsonify({"error": "Invalid subject length."}), 400
    if not (5 <= len(message) <= 1000):
        return jsonify({"error": "Invalid message length."}), 400

    subject = clean_text(subject)
    message = clean_text(message)

    cursor.execute(
        """
        INSERT INTO enquiries (user_id, product_id, order_id,
        subject, message, status, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, 'open', NOW(), NOW())
    """,
        (
            current_user["user_id"],
            product_id,
            order_id,
            subject,
            message,
        ),
    )
    enquiry_id = cursor.lastrowid

    cursor.execute(
        """
        INSERT INTO enquiry_message (enquiry_id, sender_role, message, created_at)
        VALUES (%s, 'user', %s, NOW())
    """,
        (enquiry_id, message),
    )

    logger.info(
        f"""Enquiry created by user \"{current_user['username']}\"
                with subject: {subject}"""
    )
    db.commit()

    return jsonify({"message": "Enquiry submitted", "enquiry_id": enquiry_id}), 201


@purchases_bp.route("/enquiries", methods=["GET"])
@token_req
def get_user_enquiries(current_user):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        "SELECT * FROM enquiries WHERE user_id = %s ORDER BY created_at DESC",
        (current_user["user_id"],),
    )
    enquiries = cursor.fetchall()

    for enquiry in enquiries:
        cursor.execute(
            """
            SELECT * FROM enquiry_message
            WHERE enquiry_id = %s
            AND message != %s
            ORDER BY created_at ASC
            """,
            (enquiry["enquiry_id"], enquiry["message"]),
        )
        enquiry["messages"] = cursor.fetchall()  # <- move this inside loop

    return jsonify(enquiries), 200


@purchases_bp.route("/enquiries/<int:enquiry_id>/reply", methods=["POST"])
@token_req
def reply_to_enquiry(current_user, enquiry_id):
    data = request.get_json()
    message = data.get("message", "").strip()

    # Validate length
    if len(message) < 5 or len(message) > 1000:
        return jsonify({"error": "Message must be 5–1000 characters."}), 400

    # Sanitize
    safe_message = clean_text(message)

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        """INSERT INTO enquiry_message (enquiry_id, sender_role, message)
        VALUES (%s, %s, %s)""",
        (enquiry_id, "admin", safe_message),
    )

    logger.info(
        f"""Admin \"{current_user['username']}\"
                replied to enquiry ID: {enquiry_id}."""
    )
    db.commit()
    return jsonify({"message": "Reply sent"})


@purchases_bp.route("/admin/enquiries", methods=["GET"])
@token_req
def get_all_enquiries(current_user):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT e.enquiry_id AS enquiry_id, e.subject, e.message
        AS initial_message, e.user_id, e.created_at, u.username
        FROM enquiries e
        JOIN users u ON u.user_id = e.user_id
        ORDER BY e.created_at DESC
    """
    )
    enquiries = cursor.fetchall()

    for enquiry in enquiries:
        cursor.execute(
            """
            SELECT message_id, sender_role, message, created_at
            FROM enquiry_message
            WHERE enquiry_id = %s
            ORDER BY created_at ASC
        """,
            (enquiry["enquiry_id"],),
        )
        enquiry["messages"] = cursor.fetchall()

    logger.info(
        f"""User \"{current_user['username']}\" retrieved all enquiries.
                Total enquiries: {len(enquiries)}"""
    )

    return jsonify(enquiries)


@purchases_bp.route("/enquiries/<int:enquiry_id>/userreply", methods=["POST"])
@token_req
def reply_to_enquiry_user(current_user, enquiry_id):
    data = request.get_json()
    message = data.get("message", "").strip()

    # Validate length
    if len(message) < 5 or len(message) > 1000:
        return jsonify({"error": "Message must be 5–1000 characters."}), 400

    # Sanitize
    safe_message = clean_text(message)

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        """INSERT INTO enquiry_message (enquiry_id, sender_role, message)
        VALUES (%s, %s, %s)""",
        (enquiry_id, "user", safe_message),
    )

    logger.info(
        f"""User \"{current_user['username']}\"
                replied to enquiry ID: {enquiry_id}."""
    )
    db.commit()
    return jsonify({"message": "Reply sent"})


@purchases_bp.route("/products/<int:product_id>/purchased", methods=["GET"])
@token_req
def has_purchased(current_user, product_id):
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """
        SELECT 1 FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = %s AND oi.product_id = %s
        LIMIT 1
    """,
        (current_user["user_id"], product_id),
    )

    purchased = cur.fetchone() is not None
    return jsonify({"purchased": purchased})


@purchases_bp.route("/products/<int:product_id>/reviews/my", methods=["GET"])
@token_req
def has_user_reviewed(current_user, product_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "SELECT 1 FROM reviews WHERE user_id = %s AND product_id = %s",
        (current_user["user_id"], product_id),
    )
    exists = cursor.fetchone() is not None
    return jsonify({"reviewed": exists}), 200
