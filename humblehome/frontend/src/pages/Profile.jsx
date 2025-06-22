import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Profile({ user, setUser }) {
  const [formData, setFormData] = useState({
    fullname: "",
    phonenumber: "",
    address: "",
  });
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [tab, setTab] = useState("profile");

  useEffect(() => {
    if (user) {
      setFormData({
        fullname: user.full_name || "",
        phonenumber: user.phone_number || "",
        address: user.address || "",
      });

      setImageUrl(`${process.env.REACT_APP_API_URL}/profile-image/${user.profile_pic}`);
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    const res = await fetch(`${process.env.REACT_APP_API_URL}/update-profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      alert("Profile updated!");
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

    const response = await fetch(`${process.env.REACT_APP_API_URL}/upload-profile-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (response.ok) {
      setImageUrl(`${process.env.REACT_APP_API_URL}/profile-image/${data.filename}`);
      setUser({ ...user, profile_image: data.filename });
      console.log(data);
      alert("Image Uploaded!");
    } else {
      alert(data.error || "failed to upload");
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
                src={imageUrl}
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
              <input
                type="text"
                placeholder="Full Name"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={formData.fullname}
                name="fullname"
                onChange={handleChange}
              />
              <input
                type="text"
                name="phonenumber"
                placeholder="Phone number"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={formData.phonenumber}
                onChange={handleChange}
              />
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
      </div>
    </main>
  );
}

export default Profile;
