import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function Cart() {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cartUpdated"));
  }, [cart]);

  const increment = (productId) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decrement = (productId) => {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.product_id !== productId)
    );
    toast.success("Item removed from cart");
  };

  const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  if (cart.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Your Cart</h2>
        <p className="mb-4">Your cart is empty.</p>
        <Link to="/">
          <button className="bg-blue-500 text-white px-4 py-2 rounded">
            ← Continue Shopping
          </button>
        </Link>
      </div>
    );
  }

  return (
    <main className="w-full flex flex-col items-center px-4 sm:px-6 lg:px-8 py-6">
      <div className="w-full max-w-6xl">
        <div className="p-4 bg-white mb-4 shadow-sm rounded flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Shopping Cart</h2>
          <Link to="/">
            <button className="bg-accent text-white px-4 py-2 rounded w-full sm:w-auto">
              ← Continue Shopping
            </button>
          </Link>
        </div>

        <div className="overflow-x-auto bg-white shadow-sm rounded p-4">
          <table className="min-w-full table-auto text-left text-sm">
            <thead>
              <tr className="border-b font-semibold">
                <th className="px-4 py-2">Image</th>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Quantity</th>
                <th className="px-4 py-2">Subtotal</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.product_id} className="border-b">
                  <td className="px-4 py-2">
                    <img
                      src={`/${item.thumbnail}`}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  </td>
                  <td className="px-4 py-2 max-w-[200px] break-words">{item.name}</td>
                  <td className="px-4 py-2">${item.price.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decrement(item.product_id)}
                        className="bg-gray-300 px-2 rounded"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => increment(item.product_id)}
                        className="bg-gray-300 px-2 rounded"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    ${(item.quantity * item.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeItem(item.product_id)}
                      className="text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-right mt-6">
            <p className="text-xl font-bold">Total: ${total.toFixed(2)}</p>
            <Link to="/payment">
              <button className="bg-accent text-white px-6 py-2 mt-4 rounded w-full sm:w-auto">
                Proceed to Checkout
              </button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
