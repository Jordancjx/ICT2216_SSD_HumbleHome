import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import STLViewer from "../STLViewer";
import toast from "react-hot-toast";
import PropTypes from "prop-types";

export default function ProductDetail({ user }) {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [ReviewData, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 5;
  const [reviewStats, setReviewStats] = useState(null);
  const [sort, setSort] = useState("date"); // "date" or "rating"
  const [form, setForm] = useState({ comment: "", rating: 0 });
  const [hasPurchased, setHasPurchased] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const sanitizeInput = (str) => str.replace(/[<>\/\\'"`]/g, "").trim();
  const isValidComment = (str) => str.length >= 5 && str.length <= 500;

  useEffect(() => {
    const checkPurchase = async () => {
      try {
        const res = await fetch("/api/purchase-history", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const data = await res.json();
        const bought = data.some((order) =>
          order.items.some((item) => item.product_id === parseInt(id))
        );
        setHasPurchased(bought);
      } catch (err) {
        console.error("Error checking purchase history:", err);
      }
    };

    if (user?.role === "customer") checkPurchase();
  }, [id, user]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    fetchReviews();
    fetchReviewStats();
    // console.log(user);
    if (user?.role === "customer") {
      checkIfUserReviewed();
    }
  }, [id, page, sort, user]);

  const handleRating = (value) => {
    setForm({ ...form, rating: value });
  };

  const checkIfUserReviewed = async () => {
    try {
      const res = await fetch(`/api/products/${id}/reviews/my`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      setHasReviewed(data.reviewed); // expects boolean response
    } catch (err) {
      console.error("Error checking user review:", err);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch(
        `/api/products/${id}/reviews?page=${page}&per_page=${itemsPerPage}&sort=${sort}`
      );
      const data = await res.json();

      if (data.reviews) {
        setReviews(data.reviews);
        setTotalPages(data.total_pages);
      } else {
        setReviews([]); // fallback
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanComment = sanitizeInput(form.comment);

    if (!isValidComment(cleanComment)) {
      toast.error("Comment must be 5–500 characters.");
      return;
    }

    if (form.rating < 1 || form.rating > 5) {
      toast.error("Please select a rating between 1 and 5.");
      return;
    }

    try {
      const response = await fetch(`/api/products/${id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          comment: cleanComment,
          rating: form.rating,
        }),
      });

      if (response.ok) {
        setForm({ comment: "", rating: 0 });
        fetchReviews();
        toast.success(`Review Submitted! Thank you!`);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to submit review");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error submitting review");
    }
  };

  const fetchReviewStats = async () => {
    try {
      const res = await fetch(
        `/api/products/${id}/reviews/stats`
      );
      const data = await res.json();
      setReviewStats(data);
      console.log(data);
    } catch (err) {
      console.error("Error fetching review stats:", err);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) throw new Error("Product not found");
        const data = await res.json();
        setProduct(data);
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    fetchReviews();
    fetchReviewStats();
  }, [id, page, sort]);

  const addToCart = () => {
    if (!product) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      let updated;

      if (existing) {
        updated = prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        updated = [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            quantity: 1,
            price: parseFloat(product.price),
            thumbnail: product.thumbnail_image,
          },
        ];
      }

      localStorage.setItem("cart", JSON.stringify(updated));
      window.dispatchEvent(new Event("cartUpdated"));
      return updated;
    });

    toast.success(`${product.name} added to cart`);
  };

  if (loading) return <p className="p-8">Loading...</p>;
  if (!product) return <p className="p-8">Product not found.</p>;

  return (
    <main className="w-full pb-10 flex flex-col items-center">
      <section className="w-full flex justify-center items-center mt-5">
        <div
          id="banner"
          className="relative bg-gray-200 w-5/6 flex flex-col md:flex-row h-[600px] md:h-96 items-center text-center"
        >
          {/* Text side */}
          <div className="w-full md:w-1/2 flex items-start md:items-center px-4 md:px-6 py-4 md:py-0">
            <div className="w-full text-left">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold">
                {product.name}
              </h1>

              <h2 className="mt-5 text-md sm:text-lg">{product.description}</h2>

              <p className="mb-2 text-sm mt-3">
                {product.stock > 0 ? (
                  <span className="text-green-600">
                    In stock: {product.stock}
                  </span>
                ) : (
                  <span className="text-red-600 font-bold">Out of stock</span>
                )}
              </p>

              {user?.role === "customer" && (
                <button
                  className={`px-4 py-2 rounded text-white block w-full sm:w-auto ${
                    product.stock > 0
                      ? "bg-accent hover:bg-accent_focused"
                      : "bg-gray-400 cursor-not-allowed"
                  }`}
                  onClick={addToCart}
                  disabled={product.stock <= 0}
                >
                  Add to Cart
                </button>
              )}
            </div>
          </div>

          {/* STLViewer side */}
          <div className="w-full md:w-1/2 flex-grow h-full flex justify-center items-center px-4 md:px-6 py-4 md:py-0">
            <div className="w-full h-full">
              <STLViewer url={`/api/${product.model_file}`} />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full flex justify-center items-start mt-6 px-4 md:px-0">
        <div className="w-5/6 flex flex-col md:flex-row gap-8">
          {/* Left column: reviews */}
          <div className="w-full md:w-1/2 px-2 md:px-4 bg-page py-6 rounded shadow">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6">
              <div className="flex items-center justify-center md:justify-start mb-4 md:mb-0">
                <div className="text-4xl font-bold text-gray-800 mr-2">
                  ⭐{" "}
                  {reviewStats?.average_rating != null
                    ? reviewStats.average_rating.toFixed(1)
                    : "N/A"}
                </div>
                <div className="flex flex-col ml-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className="text-yellow-400 text-lg">
                        {reviewStats?.average_rating >= i
                          ? "★"
                          : reviewStats?.average_rating >= i - 0.5
                          ? "☆"
                          : "☆"}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">
                    Based on {reviewStats?.total_reviews || 0} review
                    {reviewStats?.total_reviews !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Review form or messages */}
            {hasPurchased ? (
              hasReviewed ? (
                <p className="text-sm text-gray-500 italic mb-6">
                  You&apos;ve already submitted a review for this product.
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                  <textarea
                    autoFocus={false}
                    name="comment"
                    value={form.comment}
                    onChange={handleChange}
                    placeholder="Write your review..."
                    className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
                    required
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-medium">
                      Your Rating:
                    </span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        onClick={() => handleRating(star)}
                        className={`cursor-pointer text-2xl ${
                          form.rating >= star
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition"
                  >
                    Submit Review
                  </button>
                </form>
              )
            ) : (
              <p className="text-sm text-gray-500 italic mb-6">
                You must purchase this product to leave a review.
              </p>
            )}

            {/* Reviews List */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Customer Reviews</h2>
              {ReviewData.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No reviews yet.</p>
              ) : (
                <ul className="space-y-4 max-h-[400px] overflow-y-auto">
                  {ReviewData.map((review, idx) => (
                    <li
                      key={idx}
                      className="border p-4 rounded bg-white shadow-sm text-left"
                    >
                      <div className="flex items-center mb-1">
                        <span className="font-bold mr-2">
                          {review.username}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-yellow-400 text-lg mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star}>
                            {review.rating >= star ? "★" : "☆"}
                          </span>
                        ))}
                      </div>
                      <p className="text-gray-800">{review.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6 space-x-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="px-4 py-1 text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Right column: more images */}
          <div className="w-full md:w-1/2 px-2 md:px-4">
            <div className="py-4 flex justify-center md:justify-start">
              <h1 className="text-2xl font-bold">More Images</h1>
            </div>
            {product.images && product.images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {product.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={`/api/${img}`}
                    alt={`Product image ${idx + 1}`}
                    className="w-full h-48 sm:h-64 object-cover rounded shadow"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

ProductDetail.propTypes = {
  user: PropTypes.shape({
    role: PropTypes.string.isRequired,
  }),
};
