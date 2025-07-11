import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import PropTypes from "prop-types";

function AdminDashboard({ user, setUser }) {
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("products");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [newCategory, setNewCategory] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [categoryStats, setCategoryStats] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [replyMessages, setReplyMessages] = useState({});
  const [orders, setOrders] = useState([]);

  const sanitizeInput = (str) => str.replace(/[<>\/\\'"`]/g, "").trim();
  const isValidMessage = (str) => str.length >= 5 && str.length <= 1000;

  //Modals states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);

  const [editProduct, setEditProduct] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    stock: "",
    status: "",
    thumbnail: null,
    existingImages: [], // Initialize as an empty array
    imagesToDelete: [],
    newImages: [],
  });

  useEffect(() => {
    if (activeTab === "orders") {
      fetchOrders();
    }
  }, [activeTab]);

  async function fetchOrders() {
    try {
      const res = await fetch("/api/admin/orders", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(data);
        console.log(data);
      } else {
        toast.error(data.error || "Failed to load orders");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading orders");
    }
  }

  async function handleOrderStatusChange(orderId, newStatus) {
    try {
      const res = await fetch(`/api/admin/update_order_status/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.order_id === orderId ? { ...order, status: newStatus } : order
          )
        );
        toast.success("Order status updated");
      } else {
        toast.error(data.error || "Failed to update order status");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating order status");
    }
  }

  useEffect(() => {
    if (activeTab === "enquiries") {
      fetchEnquiries();
    }
  }, [activeTab]);

  const fetchEnquiries = async () => {
    try {
      const res = await fetch("/api/admin/enquiries", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      setEnquiries(data);
    } catch (err) {
      toast.error("Failed to fetch enquiries");
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    stock: "",
    model_file: null,
    thumbnail: null,
    images: [],
  });
  const modalRef = useRef();

  // Modal controls
  // Modal controls
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        if (showModal) {
          setShowModal(false);
        }
        if (showEditModal) {
          setShowEditModal(false);
          setEditProduct(null);
        }
        if (showAddCategoryModal) {
          setShowAddCategoryModal(false);
          setNewCategory("");
        }
      }
    };

    if (showModal || showEditModal || showAddCategoryModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showModal, showEditModal, showAddCategoryModal]);

  const validateImageFile = (file) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    const maxSize = 3 * 1024 * 1024; // 3MB

    if (!allowedTypes.includes(file.type)) {
      toast.error(`Invalid file type: ${file.name}`);
      return false;
    }

    if (file.size > maxSize) {
      toast.error(`File too large (max 3MB): ${file.name}`);
      return false;
    }

    return true;
  };

  const handleEditChange = (e) => {
    const { name, value, type, files } = e.target;

    if (type === "file" && name === "newImages") {
      const validNewImages = Array.from(files).filter(validateImageFile);
      setEditProduct((prev) => ({
        ...prev,
        newImages: [...prev.newImages, ...validNewImages],
      }));
    } else if (type === "file" && name === "thumbnail") {
      if (validateImageFile(files[0])) {
        setEditProduct((prev) => ({
          ...prev,
          thumbnail: files[0],
        }));
      }
    } else {
      setEditProduct((prev) => ({
        ...prev,
        [name]: value, // Update other fields like name, price, etc.
      }));
    }
  };

  const fetchCategoryStats = async () => {
    try {
      const res = await fetch("/api/categories_with_count");
      const data = await res.json();
      setCategoryStats(data);
    } catch (err) {
      console.error("Error fetching category stats:", err);
    }
  };

  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDeleteImage = (imageUrl) => {
    setEditProduct((prev) => ({
      ...prev,
      existingImages: prev.existingImages.filter((img) => img !== imageUrl),
      imagesToDelete: [...prev.imagesToDelete, imageUrl],
    }));
  };

  const handleDrop = (index) => {
    if (dragIndex === null || dragIndex === index) return;

    const updatedImages = [...editProduct.existingImages];
    const [draggedImage] = updatedImages.splice(dragIndex, 1);
    updatedImages.splice(index, 0, draggedImage);

    setEditProduct((prev) => ({
      ...prev,
      existingImages: updatedImages,
    }));

    setDragIndex(null);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?"))
      return;

    try {
      const res = await fetch(`/api/admin/delete_product/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (res.ok) {
        toast.success("Product deleted.");
        fetchProducts(); // Refresh the product list
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to delete product.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Server error.");
    }
  };

  const handleUpdateSubmit = async (e, productId) => {
    e.preventDefault();

    const data = new FormData();

    // Add fields
    ["name", "price", "description", "category", "stock", "status"].forEach(
      (key) => {
        if (editProduct[key]) data.append(key, editProduct[key]);
      }
    );

    // Add thumbnail if updated
    if (editProduct.thumbnail instanceof File) {
      data.append("thumbnail", editProduct.thumbnail);
    }

    // Append reordered images
    data.append(
      "existing_images_order",
      JSON.stringify(editProduct.existingImages)
    );

    // Append images to delete
    if (editProduct.imagesToDelete.length > 0) {
      data.append(
        "images_to_delete",
        JSON.stringify(editProduct.imagesToDelete)
      );
    }

    // Append new images
    if (editProduct.newImages.length > 0) {
      editProduct.newImages.forEach((image) => {
        data.append("images", image);
      });
    }

    // Append thumbnail if updated
    if (editProduct.thumbnail instanceof File) {
      data.append("thumbnail", editProduct.thumbnail);
    }

    // Send request
    try {
      const res = await fetch(`/api/admin/api/update_product/${productId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: data,
      });

      if (res.ok) {
        toast.success("Product updated successfully!");
        setShowEditModal(false);
        fetchProducts();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to update product.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong.");
    }
  };

  const handleReply = async (enquiryId) => {
    const cleanMessage = sanitizeInput(replyMessages[enquiryId] || "");

    if (!isValidMessage(cleanMessage)) {
      toast.error("Message must be 5–1000 characters.");
      return;
    }

    try {
      const res = await fetch(`/api/enquiries/${enquiryId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ message: cleanMessage }),
      });

      if (res.ok) {
        toast.success("Reply sent!");
        setReplyMessages((prev) => ({
          ...prev,
          [enquiryId]: "",
        }));
        fetchEnquiries(); // Refresh
      } else {
        toast.error("Failed to send reply");
      }
    } catch (err) {
      toast.error("Server error");
    }
  };

  // Fetch all products for product management
  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      const data = await response.json();
      console.log(data);
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        const data = await response.json();
        // console.log(data);
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategoryStats();
    fetchProducts();
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();

    console.log({
      model_file: formData.model_file,
      thumbnail: formData.thumbnail,
      images: formData.images,
    });

    data.append("name", formData.name);
    data.append("price", formData.price);
    data.append("description", formData.description);
    data.append("category", formData.category);
    data.append("stock", formData.stock);
    data.append("model_file", formData.model_file);
    data.append("thumbnail", formData.thumbnail);

    formData.images.forEach((file) => {
      data.append("images", file);
    });

    const res = await fetch("/api/admin/add_product", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: data,
    });

    const response = await res.json();
    if (res.ok) {
      console.log(response);
      setShowModal(false);
      fetchProducts();
      toast.success("Product added successfully!");
    } else {
      toast.error(`${response.error || "Failed to upload"}`);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "images") {
      setFormData((prev) => ({
        ...prev,
        images: Array.from(files),
      }));
    } else if (files && files.length > 0) {
      console.log(`File input ${name}:`, files[0]);
      setFormData((prev) => ({
        ...prev,
        [name]: files[0],
      }));
    } else {
      console.log(`Non-file input ${name}:`, value);
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  return (
    <main className="w-full flex flex-col items-center min-h-screen">
      <div className="w-full flex justify-center items-center">
        <div className="w-full px-4 md:px-8 py-4 flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-1/4 md:pr-8 mb-4 md:mb-0">
            <div className="max-w-sm rounded bg-white overflow-hidden shadow-lg mx-auto md:mx-0">
              <div className="px-6 py-4">
                <h2 className="font-bold text-md mb-2">Categories</h2>
                <div className="flex flex-col gap-2">
                  <button
                    className={`py-2 px-4 rounded text-left shadow text-sm sm:text-base ${
                      activeTab === "products"
                        ? "bg-accent text-white font-bold"
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("products")}
                  >
                    Products
                  </button>
                  <button
                    className={`py-2 px-4 rounded text-left shadow text-sm sm:text-base ${
                      activeTab === "enquiries"
                        ? "bg-accent text-white font-bold"
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("enquiries")}
                  >
                    Enquiries
                  </button>
                  <button
                    className={`py-2 px-4 rounded text-left shadow text-sm sm:text-base ${
                      activeTab === "orders"
                        ? "bg-accent text-white font-bold"
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("orders")}
                  >
                    Orders
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <section className="w-full md:w-3/4">
            {/** //////// Product Management Tab ///////////// */}
            {activeTab === "products" && (
              <div>
                <div className="p-4 bg-white mb-2 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between rounded gap-4 sm:gap-0">
                  <h2 className="text-xl font-bold">Product Management</h2>
                  <div className="flex gap-4 items-center w-full sm:w-auto">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="border px-3 py-2 rounded w-full sm:w-auto"
                    >
                      <option value="All">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setShowModal(true)}
                      className="bg-accent text-white py-2 px-4 rounded shadow hover:bg-accent_focused text-sm sm:text-base whitespace-nowrap"
                    >
                      Add Product
                    </button>
                  </div>
                </div>
                <div className="overflow-auto bg-white shadow-sm rounded p-4">
                  <table className="min-w-full table-auto text-left text-sm">
                    <thead>
                      <tr className="border-b font-semibold">
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Price</th>
                        <th className="px-4 py-2">Description</th>
                        <th className="px-4 py-2">Category</th>
                        <th className="px-4 py-2">Stock</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products
                        .filter(
                          (product) =>
                            selectedCategory === "All" ||
                            product.category === selectedCategory
                        )
                        .map((product) => (
                          <tr key={product.id} className="border-b">
                            <td className="px-4 py-2">{product.name}</td>
                            <td className="px-4 py-2">
                              ${parseFloat(product.price).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 whitespace-pre-wrap max-w-xs">
                              {product.description}
                            </td>
                            <td className="px-4 py-2">{product.category}</td>
                            <td className="px-4 py-2">{product.stock}</td>
                            <td className="px-4 py-2 capitalize">
                              <span
                                className={`inline-block px-2 py-1 rounded text-white text-xs ${
                                  product.status === "active"
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                                }`}
                              >
                                {product.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setShowEditModal(true);
                                  setEditProduct({
                                    ...product,
                                    existingImages: product.images || [],
                                    imagesToDelete: [],
                                    newImages: [],
                                  });
                                }}
                                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs sm:text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="bg-red-500 text-white px-3 py-1 rounded ml-2 hover:bg-red-600 text-xs sm:text-sm"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 mt-5 bg-white mb-2 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between rounded gap-4 sm:gap-0">
                  <h2 className="text-xl font-bold">Categories Management</h2>
                  <div className="flex gap-4 items-center w-full sm:w-auto">
                    <button
                      onClick={() => setShowAddCategoryModal(true)}
                      className="bg-accent text-white py-2 px-4 rounded shadow hover:bg-accent_focused text-sm sm:text-base whitespace-nowrap"
                    >
                      Add Category
                    </button>
                  </div>
                </div>
                <div className="overflow-auto bg-white shadow-sm rounded p-4">
                  <h3 className="text-lg font-bold mb-4">Categories Table</h3>
                  <table className="min-w-full table-auto text-left text-sm">
                    <thead>
                      <tr className="border-b font-semibold">
                        <th className="px-4 py-2">Category</th>
                        <th className="px-4 py-2">Number of Products</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryStats.map((cat) => (
                        <tr key={cat.id} className="border-b">
                          <td className="px-4 py-2">{cat.name}</td>
                          <td className="px-4 py-2">{cat.product_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "enquiries" && (
              <div className="p-4 bg-white shadow rounded space-y-4">
                <h2 className="text-xl font-bold">User Enquiries</h2>
                {enquiries.length === 0 ? (
                  <p>No enquiries found.</p>
                ) : (
                  enquiries.map((enquiry) => (
                    <div
                      key={enquiry.enquiry_id}
                      className="border p-4 rounded shadow-sm"
                    >
                      <div className="mb-2">
                        <h3 className="font-semibold">{enquiry.subject}</h3>
                        <p className="text-sm text-gray-500">
                          From: {enquiry.username} (
                          {new Date(enquiry.created_at).toLocaleString()})
                        </p>
                      </div>

                      <div className="space-y-2 border-l-2 pl-4 border-orange-400 mb-3">
                        <p>
                          <strong>Initial:</strong> {enquiry.initial_message}
                        </p>
                        {enquiry.messages.map((msg) => (
                          <div key={msg.message_id} className="text-sm">
                            <p className="text-gray-700">
                              <span className="font-semibold">
                                {msg.sender_role}:
                              </span>{" "}
                              {msg.message}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {new Date(msg.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 items-center flex-col sm:flex-row">
                        <input
                          type="text"
                          placeholder="Reply..."
                          className="border px-3 py-1 rounded w-full sm:w-auto flex-grow"
                          value={replyMessages[enquiry.enquiry_id] || ""}
                          onChange={(e) =>
                            setReplyMessages((prev) => ({
                              ...prev,
                              [enquiry.enquiry_id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          onClick={() => handleReply(enquiry.enquiry_id)}
                          className="bg-accent text-white px-4 py-1 rounded whitespace-nowrap"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "orders" && (
              <div>
                <div className="p-4 bg-white mb-2 shadow-sm flex items-center justify-between rounded">
                  <h2 className="text-xl font-bold">Orders Management</h2>
                </div>

                <div className="overflow-auto bg-white shadow-sm rounded p-4">
                  <table className="min-w-full table-auto text-left text-sm">
                    <thead>
                      <tr className="border-b font-semibold">
                        <th className="px-4 py-2">Order ID</th>
                        <th className="px-4 py-2">Customer</th>
                        <th className="px-4 py-2">Order Date</th>
                        <th className="px-4 py-2">Total Amount</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-4">
                            No orders found.
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => (
                          <tr key={order.order_id} className="border-b">
                            <td className="px-4 py-2">{order.order_id}</td>
                            <td className="px-4 py-2">{order.username}</td>
                            <td className="px-4 py-2">
                              {new Date(order.order_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">
                              ${parseFloat(order.total_amount).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 capitalize">
                              {order.status}
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={order.status}
                                onChange={(e) =>
                                  handleOrderStatusChange(
                                    order.order_id,
                                    e.target.value
                                  )
                                }
                                className="border rounded px-2 py-1 text-sm"
                              >
                                <option value="pending">Pending</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-lg p-4 sm:p-6 w-[90%] sm:w-full max-w-md relative shadow-lg overflow-auto max-h-[90vh]"
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black text-2xl font-bold leading-none"
              onClick={() => setShowModal(false)}
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-4">Add New Product</h3>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <input
                type="text"
                name="name"
                onChange={handleChange}
                placeholder="Name"
                required
                className="border px-3 py-2 rounded"
              />
              <input
                type="number"
                name="price"
                onChange={handleChange}
                placeholder="Price"
                required
                className="border px-3 py-2 rounded"
              />
              <textarea
                name="description"
                onChange={handleChange}
                placeholder="Description"
                required
                className="border px-3 py-2 rounded"
              />
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="border p-2 rounded"
                required
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                name="stock"
                onChange={handleChange}
                placeholder="Stock"
                required
                className="border px-3 py-2 rounded"
              />
              <input
                type="file"
                name="model_file"
                onChange={handleChange}
                accept=".stl"
                required
                className="border px-3 py-2 rounded"
              />

              <label className="text-sm text-gray-600">Upload Thumbnail</label>
              <input
                type="file"
                name="thumbnail"
                onChange={handleChange}
                accept="image/*"
                required
                className="border px-3 py-2 rounded"
              />

              <label className="text-sm text-gray-600">
                Upload Product Images (you can select multiple)
              </label>
              <input
                type="file"
                name="images"
                multiple
                onChange={handleChange}
                accept="image/*"
                className="border px-3 py-2 rounded"
              />
              {formData.images.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {formData.images.map((file, idx) => (
                    <img
                      key={idx}
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${idx}`}
                      className="w-20 h-20 object-cover border rounded"
                    />
                  ))}
                </div>
              )}

              <button
                type="submit"
                className="bg-primary text-white py-2 rounded hover:bg-primary-dark"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-lg p-4 sm:p-6 w-[90%] sm:w-full max-w-md relative shadow-lg overflow-auto max-h-[90vh]"
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black text-2xl font-bold leading-none"
              onClick={() => {
                setShowEditModal(false);
                setEditProduct(null);
              }}
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-4">Edit Product</h3>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => handleUpdateSubmit(e, editProduct.id)}
            >
              <input
                type="text"
                name="name"
                value={editProduct.name}
                onChange={handleEditChange}
                required
                className="border px-3 py-2 rounded"
              />
              <input
                type="number"
                name="price"
                value={editProduct.price}
                onChange={handleEditChange}
                required
                className="border px-3 py-2 rounded"
              />
              <textarea
                name="description"
                value={editProduct.description}
                onChange={handleEditChange}
                required
                className="border px-3 py-2 rounded"
              />
              <select
                name="category"
                value={editProduct.category}
                onChange={handleEditChange}
                required
                className="border p-2 rounded"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                name="stock"
                value={editProduct.stock}
                onChange={handleEditChange}
                required
                className="border px-3 py-2 rounded"
              />
              <select
                name="status"
                value={editProduct.status || "active"}
                onChange={handleEditChange}
                className="border rounded px-2 py-1"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <label className="text-sm">Replace Thumbnail</label>
              <input
                type="file"
                name="thumbnail"
                onChange={handleEditChange}
                accept="image/*"
                className="border px-3 py-2 rounded"
              />

              <label className="text-sm">Replace Images</label>
              <input
                type="file"
                name="images"
                multiple
                onChange={handleEditChange}
                accept="image/*"
                className="border px-3 py-2 rounded"
              />

              <div>
                <h4 className="font-bold mb-2">Existing Images</h4>
                <div className="flex gap-2 flex-wrap">
                  {editProduct.existingImages.map((image, index) => (
                    <div
                      key={index}
                      className="relative w-20 h-20 border rounded"
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(index)}
                    >
                      <img
                        src={`/api/${image}`}
                        alt={`Product-${index}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleDeleteImage(image)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-2">Add New Images</h4>
                <input
                  type="file"
                  name="newImages"
                  multiple
                  onChange={handleEditChange}
                  accept="image/*"
                  className="border p-2 rounded"
                />
                <div className="flex gap-2 flex-wrap mt-2">
                  {editProduct.newImages.map((file, idx) => (
                    <img
                      key={idx}
                      src={URL.createObjectURL(file)}
                      alt={`Preview-${idx}`}
                      className="w-20 h-20 object-cover border rounded"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="bg-accent text-white py-2 rounded hover:bg-primary-dark"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-lg p-4 sm:p-6 w-[90%] sm:w-full max-w-sm relative shadow-lg"
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black text-2xl font-bold leading-none"
              onClick={() => setShowAddCategoryModal(false)}
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-4">Add New Category</h3>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData();
                form.append("name", newCategory);
                try {
                  const res = await fetch("/api/admin/api/add_category", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: form,
                  });
                  const response = await res.json();
                  if (res.ok) {
                    toast.success("Category added!");
                    setNewCategory("");
                    setShowAddCategoryModal(false);
                    const categoryRes = await fetch("/api/categories");
                    const categoryData = await categoryRes.json();
                    setCategories(categoryData);
                  } else {
                    toast.error(response.error || "Failed to add category.");
                  }
                } catch (err) {
                  console.error(err);
                  toast.error("An error occurred.");
                }
              }}
            >
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category Name"
                required
                className="border px-3 py-2 rounded"
              />
              <button
                type="submit"
                className="bg-primary text-white py-2 rounded hover:bg-primary-dark"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

AdminDashboard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    role: PropTypes.string,
  }).isRequired,

  setUser: PropTypes.func.isRequired,
};
export default AdminDashboard;
