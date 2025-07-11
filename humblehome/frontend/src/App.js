import { useEffect, useState, useContext } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Header from "./components/Header";
import Footer from "./components/Footer";
import AdminRoute from "./components/AdminRoute";
import UserRoute from "./components/UserRoute";
import PaymentConfirmation from "./pages/PaymentConfirmation.jsx";
import HomePage from "./pages/HomePage";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Cart from "./pages/Cart.jsx";
import Payment from "./pages/Payment.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import PasswordResetConfirmation from "./pages/ResetConfimation.jsx";
import VerifyOtp from "./pages/VerifyOtp.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Contact from "./pages/Contact.jsx";

import { SessionTimeoutContext } from "./components/SessionTimeoutContext.jsx";

export default function App() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const { isInactive } = useContext(SessionTimeoutContext);

  const fetchProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingUser(false);
      return;
    }

    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        localStorage.removeItem("token");
        setUser(null);
        alert("Your session has expired. Please log in again.");
        navigate("/login");
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user && isInactive) {
      setShowSessionModal(true);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("pending_2fa_user_id");
      setUser(null);
    }
  }, [isInactive, user]);

  const handleLogout = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await fetch("/api/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <div className="w-full flex items-center flex-col bg-page min-h-screen">
        <Header user={user} onLogout={handleLogout} />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/product/:id" element={<ProductDetail user={user} />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/login"
            element={<Login setUser={setUser} fetchProfile={fetchProfile} />}
          />
          <Route
            path="/verify-otp"
            element={
              <VerifyOtp setUser={setUser} fetchProfile={fetchProfile} />
            }
          />
          <Route
            path="/forgotpassword"
            element={
              <ForgotPassword setUser={setUser} fetchProfile={fetchProfile} />
            }
          />
          <Route
            path="/reset-password/confirm"
            element={<PasswordResetConfirmation />}
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/admin"
            element={
              <AdminRoute user={user} loading={loadingUser}>
                <AdminDashboard user={user} setUser={setUser} />
              </AdminRoute>
            }
          />

          <Route
            path="/cart"
            element={
              <UserRoute user={user} loading={loadingUser}>
                <Cart user={user} />
              </UserRoute>
            }
          />

          <Route
            path="/contact"
            element={
              <UserRoute user={user} loading={loadingUser}>
                <Contact user={user} />
              </UserRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <UserRoute user={user} loading={loadingUser}>
                <Profile user={user} setUser={setUser} />
              </UserRoute>
            }
          />

          <Route
            path="/hhpanel"
            element={
              <AdminLogin setUser={setUser} fetchProfile={fetchProfile} />
            }
          />

          <Route
            path="/payment"
            element={
              <UserRoute user={user} loading={loadingUser}>
                <Payment user={user} />
              </UserRoute>
            }
          />

          <Route
            path="/payment/confirmation"
            element={
              <UserRoute user={user} loading={loadingUser}>
                <PaymentConfirmation />
              </UserRoute>
            }
          />

          <Route
            path="/hhpanel"
            element={
              <AdminLogin setUser={setUser} fetchProfile={fetchProfile} />
            }
          />
        </Routes>

        {showSessionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-md shadow-md text-center max-w-sm">
              <h2 className="text-lg font-semibold text-red-600 mb-2">
                Session Expired
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                You were logged out for being inactive for 15 minutes. Please
                log in again.
              </p>
              <button
                onClick={() => {
                  setShowSessionModal(false);
                  navigate("/login");
                }}
                className="bg-orange-500 hover:bg-orange-600 px-6 py-2 text-white rounded-md"
              >
                Log In Again
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
