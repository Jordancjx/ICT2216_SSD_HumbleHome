import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import PropTypes from "prop-types";

// Input sanitization
const sanitizeInput = (str) => str.replace(/[<>\/\\'"`]/g, "").trim();

// Validation functions
const isValidCardNumber = (num) => /^\d{16}$/.test(num.replace(/\s+/g, ""));
const isValidExpiry = (exp) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(exp);
const isValidCVV = (cvv) => /^\d{3,4}$/.test(cvv);
const isValidPostal = (postal) => /^[A-Za-z0-9\s\-]{3,10}$/.test(postal);

export default function Payment({ user }) {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    name: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    // console.log(user);
    const saved = localStorage.getItem("cart");
    setCart(saved ? JSON.parse(saved) : []);
  }, [user]);

  const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const handleChange = (e) => {
    const { name, value } = e.target;

    let newValue = value;

    if (name === "cardNumber") {
      // Remove all non-digits
      const digits = value.replace(/\D/g, "").substring(0, 16);
      // Add spaces every 4 digits
      newValue = digits.replace(/(.{4})/g, "$1 ").trim();
    }

    if (name === "expiry") {
      // Remove non-digits
      const digits = value.replace(/\D/g, "").substring(0, 4);
      // Format MM/YY
      if (digits.length >= 3) {
        newValue = `${digits.substring(0, 2)}/${digits.substring(2, 4)}`;
      } else {
        newValue = digits;
      }
    }

    if (name === "cvv") {
      newValue = value.replace(/\D/g, "").substring(0, 4); // Only 3 or 4 digits
    }

    setForm((prev) => ({ ...prev, [name]: newValue }));
  };

  const handleSubmit = async (e) => {
    const token = localStorage.getItem("token");
    e.preventDefault();

    // Sanitize inputs
    const cleanForm = { ...form };
    Object.keys(cleanForm).forEach((key) => {
      if (key !== "expiry" && key !== "cardNumber" && key !== "cvv") {
        cleanForm[key] = sanitizeInput(cleanForm[key]);
      }
    });

    // Validate critical fields
    if (!isValidCardNumber(cleanForm.cardNumber)) {
      toast.error("Card number must be 16 digits.");
      return;
    }
    if (!isValidExpiry(cleanForm.expiry)) {
      toast.error("Expiry must be in MM/YY format.");
      return;
    }
    if (!isValidCVV(cleanForm.cvv)) {
      toast.error("CVV must be 3 or 4 digits.");
      return;
    }
    if (!isValidPostal(cleanForm.postalCode)) {
      toast.error("Postal code must be 3–10 alphanumeric characters.");
      return;
    }

    const formData = {
      cart: cart.map(({ product_id, quantity, price }) => ({
        product_id,
        quantity,
        price,
      })),
      shipping_address: `${cleanForm.address}, ${cleanForm.city}, ${cleanForm.postalCode}`,
      payment_method: "card",
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Checkout failed.");
      }

      toast.success("Order placed successfully!");
      localStorage.removeItem("cart");
      window.dispatchEvent(new Event("cartUpdated"));

      setTimeout(() => {
        navigate("/payment/confirmation");
      }, 1500);
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Something went wrong.");
    }
  };

  if (cart.length === 0) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">Your cart is empty.</h2>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center py-8 px-4 md:px-8">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8">
        {/* Shipping + Payment Form */}
        <form
          id="checkout-form"
          onSubmit={handleSubmit}
          className="w-full lg:w-1/2 flex flex-col gap-6"
        >
          {/* Shipping */}
          <div className="bg-white flex flex-col rounded shadow p-5">
            <h2 className="text-xl font-bold mb-4">Shipping Details</h2>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Full Name"
              className="border px-3 py-2 rounded mb-2"
              required
            />
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Street Address"
              className="border px-3 py-2 rounded mb-2"
              required
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="City"
                className="border px-3 py-2 rounded w-full"
                required
              />
              <input
                type="text"
                name="postalCode"
                value={form.postalCode}
                onChange={handleChange}
                placeholder="Postal Code"
                className="border px-3 py-2 rounded w-full"
                required
              />
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded shadow p-5">
            <h2 className="text-xl font-bold mb-4">Payment Details</h2>
            <input
              type="text"
              name="cardNumber"
              maxLength={19}
              inputMode="numeric"
              value={form.cardNumber}
              onChange={handleChange}
              placeholder="Card Number"
              className="border px-3 py-2 rounded mb-2 w-full"
              required
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                name="expiry"
                maxLength={5}
                inputMode="numeric"
                value={form.expiry}
                onChange={handleChange}
                placeholder="MM/YY"
                className="border px-3 py-2 rounded w-full"
                required
              />
              <input
                type="text"
                name="cvv"
                maxLength={4}
                inputMode="numeric"
                value={form.cvv}
                onChange={handleChange}
                placeholder="CVV"
                className="border px-3 py-2 rounded w-full"
                required
              />
            </div>
          </div>
        </form>

        {/* Order Summary */}
        <div className="w-full lg:w-1/2 flex flex-col bg-white rounded shadow p-5">
          <h2 className="text-xl font-bold mb-4">Order Summary</h2>
          <ul className="divide-y flex-grow">
            {cart.map((item) => (
              <li key={item.product_id} className="py-2 flex justify-between">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-600">
                    {item.quantity} × ${item.price.toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold">
                  ${(item.quantity * item.price).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6">
            <div className="text-right text-lg font-bold mb-4">
              Total: ${total.toFixed(2)}
            </div>
            <button
              type="submit"
              form="checkout-form"
              className="w-full bg-accent text-white py-2 px-4 rounded hover:bg-accent_focused"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Payment.propTypes = {
  user: PropTypes.shape({
    user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    role: PropTypes.string,
  }).isRequired,

  setUser: PropTypes.func.isRequired,
};
