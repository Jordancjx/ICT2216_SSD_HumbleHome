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

  const sanitizeInput = (str) =>
    str.replace(/[<>\/\\'"`]/g, "").trim();

  const isValidMessage = (str) =>
    str.length >= 5 && str.length <= 1000;

  const [passwordData, setPasswordData] = useState({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});
const [error, setError] = useState('');
const [success, setSuccess] = useState('');
const [isLoading, setIsLoading] = useState(false);

const handlePasswordInputChange = (e) => {
  const { name, value } = e.target;
  setPasswordData(prev => ({ ...prev, [name]: value }));
  // Clear errors when user types
  if (error) setError('');
};

const handlePasswordChange = async (e) => {
  e.preventDefault();
  setIsLoading(true);
  setError('');
  setSuccess('');

  // Frontend validation
  if (passwordData.newPassword !== passwordData.confirmPassword) {
    setError('New passwords do not match');
    setIsLoading(false);
    return;
  }

  if (passwordData.newPassword.length < 8) {
    setError('Password must be at least 8 characters');
    setIsLoading(false);
    return;
  }

  try {
    const response = await fetch('/api/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` // Adjust based on your auth
      },
      body: JSON.stringify({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to change password');
    }

    setSuccess('Password changed successfully!');
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
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
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await res.json();
          console.log(data);
          setEnquiries(data);
        } catch (error) {
          toast.error("Failed to fetch enquiries.");
          console.error(error);
        }
      }
    };

    fetchEnquiries();
  }, [tab, user]);

  const handleReplySubmit = async (enquiryId) => {
    const token = localStorage.getItem("token");
    const message = replyInputs[enquiryId];

    if (!message) {
      toast.error("Reply message cannot be empty.");
      return;
    }
    const cleanMessage = sanitizeInput(message || "");

    if (!isValidMessage(cleanMessage)) {
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

        // Clear input
        setReplyInputs((prev) => ({ ...prev, [enquiryId]: "" }));

        // Optionally refetch enquiries to reflect new message
        setTab("reload"); // Triggers re-fetch
        setTimeout(() => setTab("enquiries"), 50);
      } else {
        toast.error(data.error || "Failed to send reply.");
      }
    } catch (error) {
      toast.error("Something went wrong.");
      console.error(error);
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (tab === "history" && user) {
        var token = localStorage.getItem("token");
        try {
          const res = await fetch("/api/purchase-history", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await res.json();
          console.log(data);
          setPurchaseHistory(data);
        } catch (error) {
          console.error("Failed to fetch history:", error);
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
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const data = await res.json();
          if (Array.isArray(data.reviews)) {
            setMyReviews(data.reviews);
            setTotalPages(data.total_pages || 1);
          } else {
            setMyReviews([]);
            toast.error("Unexpected review data.");
          }
        } catch (error) {
          toast.error("Failed to load your reviews.");
        }
      }
    };

    fetchHistory();
    fetchMyReviews();
  }, [tab, user, page]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Redirect if no user or no token
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

      setImageUrl(`uploads/image/${user.profile_pic}`);
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
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      toast.success("Profile Updated successfully!");
      const updatedUser = {
        ...user,
        full_name: formData.fullname,
        phone_number: formData.phonenumber,
        address: formData.address,
      };
      setUser(updatedUser);
    }
  };

  const handleImageUpload = async () => {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/upload-profile-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      try {
        const data = await response.json();
        if (response.ok) {
          setImageUrl(`uploads/image${data.filename}`);
          setUser({ ...user, profile_pic: data.filename });
          console.log(data);
          // alert("Image Uploaded!");
          toast.success("Image uploaded successfully!");
        } else {
          // alert(data.error || "Failed to upload");
          toast.error(data.error || "Failed to upload");
        }
      } catch (jsonError) {
        toast.error("File size exceeds the maximum limit of 3MB.");
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setMyReviews(myReviews.filter((review) => review.id !== reviewId));
        toast.success("Review deleted successfully.");
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to delete review.");
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("An error occurred while deleting the review.");
    }
  };

  if (!user) return <p className="p-4">Loading...</p>;

  return (
    <main className="flex w-5/6 px-8 py-4">
      <div className="w-full flex-col mx-auto p-6 bg-white shadow rounded">
        <div className="profile-header w-full flex">
          {imageUrl && (
            <div className="my-4 mr-2">
              <img
                src={`api/${imageUrl}`}
                alt="Profile"
                className="h-32 w-32 object-cover rounded"
              />
            </div>
          )}
          <div className="flex flex-col justify-end">
            <h3 className="text-2xl font-bold">{user.username}</h3>
            <p className="text-sm/6">{user.email}</p>
          </div>
        </div>

        <div className="flex space-x-4 mb-6 border-b mt-5 pb-2">
          <button
            className={`px-4 py-2 rounded-t font-semibold ${
              tab === "profile"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-gray-600 hover:text-orange-500"
            }`}
            onClick={() => setTab("profile")}
          >
            Update Info
          </button>
          <button
            className={`px-4 py-2 rounded-t font-semibold ${
              tab === "history"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-gray-600 hover:text-orange-500"
            }`}
            onClick={() => setTab("history")}
          >
            Purchase History
          </button>
          <button
            className={`px-4 py-2 rounded-t font-semibold ${
              tab === "enquiries"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-gray-600 hover:text-orange-500"
            }`}
            onClick={() => setTab("enquiries")}
          >
            Enquiries
          </button>
          <button
            className={`px-4 py-2 rounded-t font-semibold ${
              tab === "security"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-gray-600 hover:text-orange-500"
            }`}
            onClick={() => setTab("security")}
          >
            Change Password
          </button>
          <button
            className={`px-4 py-2 rounded-t font-semibold ${
              tab === "myreviews"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-gray-600 hover:text-orange-500"
            }`}
            onClick={() => setTab("myreviews")}
          >
            My Reviews
          </button>
        </div>

        {tab === "profile" && (
          <>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
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
                  <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="font-semibold">Order #{order.order_id}</h4>
                    <span className="text-sm text-gray-600">
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

                  <div className="mt-3 text-sm text-gray-600">
                    <span>
                      <strong>Status:</strong> {order.status}
                    </span>
                    <span className="ml-4">
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
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold">{review.product_name}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(review.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-yellow-500 text-sm">
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
                    className="w-full p-2 border rounded mb-2"
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
                    className="px-4 py-2 text-sm text-white bg-orange-500 rounded hover:bg-orange-600"
                  >
                    Send Reply
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        {tab === "security" && (
  <div className="mt-4 space-y-6">
    <div className="border rounded p-4 shadow-sm bg-gray-50">
      <h3 className="font-semibold text-lg mb-4">Change Password</h3>
      
      <form className="space-y-4" onSubmit={handlePasswordChange}>
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Current Password
          </label>
          <input
            type="password"
            id="currentPassword"
            name="currentPassword"
            value={passwordData.currentPassword}
            onChange={handlePasswordInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
            placeholder="Enter your current password"
            required
          />
        </div>
        
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            value={passwordData.newPassword}
            onChange={handlePasswordInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
            placeholder="Enter your new password (min 8 characters)"
            required
          />
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={passwordData.confirmPassword}
            onChange={handlePasswordInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
            placeholder="Confirm your new password"
            required
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        {success && (
          <div className="text-green-500 text-sm">{success}</div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Changing...
            </>
          ) : (
            'Change Password'
          )}
        </button>
      </form>
    </div>
  </div>
)}
      </div>
        
    </main>
  );
}

Profile.propTypes = {
  user: PropTypes.shape({
    user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    full_name: PropTypes.string,
    phone_number: PropTypes.string,
    address: PropTypes.string,
    profile_pic: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};
export default Profile;
