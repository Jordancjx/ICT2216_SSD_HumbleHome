import { Link } from "react-router-dom";

export default function PaymentConfirmation() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-2xl font-bold text-green-600 mb-4">Payment Successful!</h1>
      <p className="text-gray-700 mb-6">
        Thank you for your purchase.
      </p>
      <Link
        to="/"
        className="bg-orange-500 text-white px-6 py-2 rounded hover:bg-orange-600 transition"
      >
        Return to Home
      </Link>
    </div>
  );
}