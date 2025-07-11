import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { validateImageTypeAndSize } from "../components/validator"; // Import the validation function
import PaginationControls from "../components/PaginationControl";
import PropTypes from "prop-types";

function Profile({ user, setUser }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullname: "",
    phonenumber: "",
    address: "",
  });
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [tab, setTab] = useState("profile");
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 3;
  const [enquiries, setEnquiries] = useState([]);
  const [replyInputs, setReplyInputs] = useState({});

  const sanitizeInput = (str) => str.replace(/[<>/\\'"]/g, "").trim();
  const isValidMessage = (str) => str.length >= 5 && str.length <= 1000;

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      setIsLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(passwordData),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to change password");

      setSuccess("Password changed successfully!");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchEnquiries = async () => {
      if (tab === "enquiries" && user) {
        const token = localStorage.getItem("token");
        try {
          const res = await fetch("/api/enquiries", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          setEnquiries(data);
        } catch (err) {
          toast.error("Failed to fetch enquiries.");
        }
      }
    };
    fetchEnquiries();
  }, [tab, user]);

  const handleReplySubmit = async (enquiryId) => {
    const token = localStorage.getItem("token");
    const message = replyInputs[enquiryId];
    const cleanMessage = sanitizeInput(message || "");

    if (!cleanMessage || !isValidMessage(cleanMessage)) {
      toast.error("Message must be 5–1000 characters.");
      return;
    }

    try {
      const res = await fetch(`/api/enquiries/${enquiryId}/userreply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cleanMessage }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Reply sent!");
        setReplyInputs((prev) => ({ ...prev, [enquiryId]: "" }));
        setTab("reload");
        setTimeout(() => setTab("enquiries"), 50);
      } else {
        toast.error(data.error || "Failed to send reply.");
      }
    } catch (err) {
      toast.error("Something went wrong.");
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (tab === "history" && user) {
        const token = localStorage.getItem("token");
        try {
          const res = await fetch("/api/purchase-history", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          setPurchaseHistory(data);
        } catch (err) {
          toast.error("Could not load purchase history.");
        }
      }
    };

    const fetchMyReviews = async () => {
      if (tab === "myreviews") {
        const token = localStorage.getItem("token");
        try {
          const res = await fetch(
            `/api/my-reviews?page=${page}&per_page=${itemsPerPage}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const data = await res.json();
          if (Array.isArray(data.reviews)) {
            setMyReviews(data.reviews);
            setTotalPages(data.total_pages || 1);
          } else {
            toast.error("Unexpected review data.");
          }
        } catch (err) {
          toast.error("Failed to load your reviews.");
        }
      }
    };

    fetchHistory();
    fetchMyReviews();
  }, [tab, user, page]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !token) {
      toast.error("Please log in to access your profile.");
      navigate("/login");
      return;
    }

    if (user) {
      setFormData({
        fullname: user.full_name || "",
        phonenumber: user.phone_number || "",
        address: user.address || "",
      });

      setImageUrl(`uploads/images/${user.profile_pic}`);
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const res = await fetch("/api/update-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      toast.success("Profile Updated successfully!");
      setUser({
        ...user,
        full_name: formData.fullname,
        phone_number: formData.phonenumber,
        address: formData.address,
      });
    }
  };

  const handleImageUpload = async () => {
    const token = localStorage.getItem("token");
    const form = new FormData();
    form.append("image", file);

    try {
      const response = await fetch("/api/upload-profile-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const data = await response.json();
      if (response.ok) {
        setImageUrl(`uploads/image/${data.filename}`);
        setUser({ ...user, profile_pic: data.filename });
        toast.success("Image uploaded successfully!");
      } else {
        toast.error(data.error || "Failed to upload");
      }
    } catch (error) {
      toast.error("Failed to upload image. Please try again.");
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const token = localStorage.getItem("token");
    if (!window.confirm("Are you sure you want to delete this review?")) return;

    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMyReviews(myReviews.filter((r) => r.id !== reviewId));
        toast.success("Review deleted successfully.");
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to delete review.");
      }
    } catch (err) {
      toast.error("An error occurred while deleting the review.");
    }
  };

  if (!user) return <p className="p-4">Loading...</p>;

  return (
    <main className="flex justify-center px-4 sm:px-8 py-4">
      <div className="w-full max-w-4xl flex flex-col mx-auto p-6 bg-white shadow rounded">
        {/* Profile Header */}
        <div className="profile-header w-full flex flex-col sm:flex-row items-center sm:items-start gap-4">
          {imageUrl && (
            <div className="my-4">
              <img
                src={`api/${imageUrl}`}
                alt="Profile"
                className="h-32 w-32 object-cover rounded"
              />
            </div>
          )}
          <div className="flex flex-col justify-center sm:justify-start text-center sm:text-left">
            <h3 className="text-2xl font-bold">{user.username}</h3>
            <p className="text-sm/6">{user.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap space-x-2 space-y-2 mb-6 border-b mt-5 pb-2">
          {[
            { id: "profile", label: "Update Info" },
            { id: "history", label: "Purchase History" },
            { id: "enquiries", label: "Enquiries" },
            { id: "security", label: "Change Password" },
            { id: "myreviews", label: "My Reviews" },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`min-w-[100px] px-4 py-2 rounded-t font-semibold ${
                tab === id
                  ? "border-b-2 border-orange-500 text-orange-600"
                  : "text-gray-600 hover:text-orange-500"
              }`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}

        {tab === "profile" && (
          <>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
              className="mb-2"
            />
            <button
              onClick={handleImageUpload}
              className="mt-2 py-2 px-4 bg-accent text-white rounded hover:bg-accent_focused"
            >
              Upload Profile Image
            </button>

            <form className="space-y-4 mt-4" onSubmit={handleUpdate}>
              <label className="block text-sm font-medium text-black">
                Full Name:
              </label>
              <input
                type="text"
                placeholder="Full Name"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={formData.fullname}
                name="fullname"
                onChange={handleChange}
              />
              <label className="block text-sm font-medium text-black">
                Phone Number:
              </label>
              <small>(Format: 1234 5678)</small>
              <input
                type="tel"
                name="phonenumber"
                placeholder="Phone number"
                pattern="[0-9]{4} [0-9]{4}"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={formData.phonenumber}
                onChange={handleChange}
              />
              <label className="block text-sm font-medium text-black">
                Address:
              </label>
              <input
                type="text"
                name="address"
                placeholder="Address"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={formData.address}
                onChange={handleChange}
              />

              <button
                type="submit"
                className="w-full py-2 rounded-md text-white font-semibold transition bg-orange-500 hover:bg-orange-600"
              >
                Update Profile
              </button>
            </form>
          </>
        )}

        {tab === "history" && (
          <div className="mt-4 space-y-6">
            {purchaseHistory.length === 0 ? (
              <p>No purchase history found.</p>
            ) : (
              purchaseHistory.map((order) => (
                <div
                  key={order.order_id}
                  className="border rounded p-4 shadow-sm bg-gray-50"
                >
                  <div className="flex justify-between items-center border-b pb-2 flex-col sm:flex-row sm:items-center">
                    <h4 className="font-semibold">Order #{order.order_id}</h4>
                    <span className="text-sm text-gray-600 mt-1 sm:mt-0">
                      {new Date(order.order_date).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-2 space-y-2">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-gray-700 pl-2 border-l-2 border-orange-200"
                      >
                        <p>
                          <strong>Product:</strong> {item.product_name}
                        </p>
                        <p>
                          <strong>Quantity:</strong> {item.quantity}
                        </p>
                        <p>
                          <strong>Price:</strong> $
                          {Number(item.price_at_purchase).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-sm text-gray-600 flex flex-col sm:flex-row sm:space-x-4">
                    <span>
                      <strong>Status:</strong> {order.status}
                    </span>
                    <span className="mt-1 sm:mt-0">
                      <strong>Total:</strong> $
                      {Number(order.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "myreviews" && (
          <div className="space-y-4 mt-4">
            {myReviews.length === 0 ? (
              <p>No reviews yet.</p>
            ) : (
              myReviews.map((review) => (
                <div
                  key={review.id}
                  className="border rounded p-4 shadow-sm bg-blue-50"
                >
                  <div className="flex justify-between items-center flex-col sm:flex-row sm:items-center">
                    <div className="text-center sm:text-left">
                      <h4 className="font-semibold">{review.product_name}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(review.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-red-600 hover:underline text-sm mt-2 sm:mt-0"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-yellow-500 text-sm mt-2">
                    {"★".repeat(review.rating)}{" "}
                    <span className="text-gray-300">
                      {"★".repeat(5 - review.rating)}
                    </span>
                  </p>
                  <p className="text-gray-800 mt-2">{review.text}</p>
                </div>
              ))
            )}
            <PaginationControls
              page={page}
              totalPages={totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}

        {tab === "enquiries" && (
          <div className="mt-4 space-y-4">
            {enquiries.length === 0 ? (
              <p>No enquiries submitted.</p>
            ) : (
              enquiries.map((enq) => (
                <div
                  key={enq.enquiry_id}
                  className="border p-4 rounded shadow-sm bg-gray-50"
                >
                  <h4 className="text-md font-semibold mb-1">{enq.subject}</h4>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Status:</strong> {enq.status}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    Created: {new Date(enq.created_at).toLocaleString()}
                  </p>

                  <div className="text-sm p-2 border-l-4 border-orange-300 bg-white mb-2">
                    <strong>You:</strong> {enq.message}
                  </div>

                  {enq.messages?.map((msg) => (
                    <div
                      key={msg.message_id}
                      className={`text-sm p-2 rounded mb-2 ${
                        msg.sender_role === "admin"
                          ? "bg-blue-100 border-l-4 border-blue-400"
                          : "bg-orange-100 border-l-4 border-orange-400"
                      }`}
                    >
                      <strong>
                        {msg.sender_role === "admin" ? "Admin" : "You"}:
                      </strong>{" "}
                      {msg.message}
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(msg.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}

                  <textarea
                    rows="2"
                    placeholder="Type your reply..."
                    className="w-full p-2 border rounded mb-2 resize-none"
                    value={replyInputs[enq.enquiry_id] || ""}
                    onChange={(e) =>
                      setReplyInputs((prev) => ({
                        ...prev,
                        [enq.enquiry_id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    onClick={() => handleReplySubmit(enq.enquiry_id)}
                    className="w-full sm:w-auto px-4 py-2 text-sm text-white bg-orange-500 rounded hover:bg-orange-600"
                  >
                    Send Reply
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "security" && (
          <form
            onSubmit={handlePasswordChange}
            className="flex flex-col items-center space-y-6 mt-4"
          >
            <input
              type="password"
              name="currentPassword"
              placeholder="Current Password"
              value={passwordData.currentPassword}
              onChange={handlePasswordInputChange}
              className="w-full max-w-md rounded-md border p-2 text-black"
            />
            <input
              type="password"
              name="newPassword"
              placeholder="New Password"
              value={passwordData.newPassword}
              onChange={handlePasswordInputChange}
              className="w-full max-w-md rounded-md border p-2 text-black"
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm New Password"
              value={passwordData.confirmPassword}
              onChange={handlePasswordInputChange}
              className="w-full max-w-md rounded-md border p-2 text-black"
            />
            {error && <p className="text-red-600">{error}</p>}
            {success && <p className="text-green-600">{success}</p>}

            <button
              type="submit"
              className="flex justify-center items-center px-8 py-2 bg-orange-500 rounded-md text-white font-semibold hover:bg-orange-600 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    ></path>
                  </svg>
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

Profile.propTypes = {
  user: PropTypes.object,
  setUser: PropTypes.func,
};

export default Profile;
