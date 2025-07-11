import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { useRef } from "react";
import PropTypes from "prop-types";

const Header = ({ user, onLogout }) => {
  const [cartCount, setCartCount] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const typingTimeoutRef = useRef(null);

  // Search effect as before
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (query.trim() === "") {
        setResults([]);
        return;
      }
      const fetchResults = async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          setResults(data);
        } catch (err) {
          console.error("Search failed", err);
        }
      };
      fetchResults();
    }, 300);
    return () => clearTimeout(typingTimeoutRef.current);
  }, [query]);

  // Cart count update
  useEffect(() => {
    const updateCartCount = () => {
      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      const count = cart.reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(count);
    };
    updateCartCount();
    window.addEventListener("cartUpdated", updateCartCount);
    return () => window.removeEventListener("cartUpdated", updateCartCount);
  }, []);

  return (
    <header className="w-full bg-page border-b shadow-sm">
      <div className="w-5/6 mx-auto flex items-center justify-between py-4">
        <div className="text-xl font-bold text-accent">
          <Link to="/">HumbleHome</Link>
        </div>

        {/* Hamburger for mobile */}
        <button
          className="md:hidden text-accent focus:outline-none"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Search bar hidden on very small screens for space */}
        <form
          className="hidden md:flex flex-1 mx-4 max-w-xl"
          onSubmit={(e) => e.preventDefault()}
        >
          <SearchBar query={query} setQuery={setQuery} results={results} />
        </form>

        {/* Desktop nav and cart */}
        <nav className="hidden md:flex items-center gap-4">
          {user ? (
            user.role === "admin" ? (
              <>
                <Link to="/admin" className="font-bold text-red-600">
                  Admin Dashboard
                </Link>
                <button
                  onClick={onLogout}
                  className="text-accent hover:underline"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/profile" className="text-accent hover:underline">
                  {user.username}
                </Link>
                <Link to="/contact" className="text-accent hover:underline">
                  Contact
                </Link>
                <button
                  onClick={onLogout}
                  className="text-accent hover:underline"
                >
                  Logout
                </button>
                <button
                  onClick={() => navigate("/cart")}
                  className="relative text-white bg-accent px-4 py-2 rounded hover:bg-accent_focused"
                >
                  🛒 Cart
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 text-xs bg-red-600 text-white rounded-full px-2">
                      {cartCount}
                    </span>
                  )}
                </button>
              </>
            )
          ) : (
            <>
              <Link to="/login" className="text-accent hover:underline">
                Login
              </Link>
              <Link to="/register" className="text-accent hover:underline">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden bg-page border-t border-gray-300 px-6 py-4 space-y-4">
          <form onSubmit={(e) => e.preventDefault()}>
            <SearchBar query={query} setQuery={setQuery} results={results} />
          </form>

          {user ? (
            user.role === "admin" ? (
              <>
                <Link
                  to="/admin"
                  className="block font-bold text-red-600"
                  onClick={() => setMenuOpen(false)}
                >
                  Admin Dashboard
                </Link>
                <button
                  onClick={() => {
                    onLogout();
                    setMenuOpen(false);
                  }}
                  className="block text-accent hover:underline"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/profile"
                  className="block text-accent hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  {user.username}
                </Link>
                <Link
                  to="/contact"
                  className="block text-accent hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  Contact
                </Link>
                <button
                  onClick={() => {
                    onLogout();
                    setMenuOpen(false);
                  }}
                  className="block text-accent hover:underline"
                >
                  Logout
                </button>
                <button
                  onClick={() => {
                    navigate("/cart");
                    setMenuOpen(false);
                  }}
                  className="relative text-white bg-accent px-4 py-2 rounded hover:bg-accent_focused w-full text-center"
                >
                  🛒 Cart
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 text-xs bg-red-600 text-white rounded-full px-2">
                      {cartCount}
                    </span>
                  )}
                </button>
              </>
            )
          ) : (
            <>
              <Link
                to="/login"
                className="block text-accent hover:underline"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="block text-accent hover:underline"
                onClick={() => setMenuOpen(false)}
              >
                Register
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
};

Header.propTypes = {
  user: PropTypes.shape({
    role: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }),
  onLogout: PropTypes.func.isRequired,
};

export default Header;