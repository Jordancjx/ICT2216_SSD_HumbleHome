import { useState } from 'react';

function Register() {
    const [accepted, setAccepted] = useState(false);

    // Form Variables
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
            const data = await response.json();

            if (response.ok) {
                setMessage({ text: data.message, type: 'success' });
            } else {
                setMessage({ text: data.message || 'Registration failed.', type: 'error' });
            }
        }
        catch(e) {
            console.error('Fetch error:', e);
            setMessage({ text: 'Could not connect to server.', type: 'error' });
        }
    };

    return (
        <div className="py-10 flex items-center justify-center px-4">
            <div className="bg-white w-full max-w-xl p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold text-center mb-6">Create an account</h2>
                {message.text && (
                    <p className={`text-center text-sm mt-4 mb-4 ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                        {message.text}
                    </p>
                )}
                <form className="space-y-4" onSubmit={handleRegister}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                        type="email"
                        placeholder="E-mail"
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <div className="flex items-center text-sm">
                        <input
                        type="checkbox"
                        id="privacy"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                        className="mr-2"
                        />
                        <label htmlFor="privacy">
                        I accept the <a href="#" className="text-orange-600 underline">Privacy Policy</a>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={!accepted}
                        className={`w-full py-2 rounded-md text-white font-semibold transition ${
                        accepted ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-300 cursor-not-allowed'
                        }`}
                    >
                        Create an Account
                    </button>
                </form>

                <p className="text-center text-sm mt-6">
                Already have an account?{' '}
                <a href="/Login" className="text-black underline">Log In</a>
                </p>
            </div>
        </div>
    );
}


export default Register;
