import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:5000");

const Chat = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const socketRef = useRef(socket);

    useEffect(() => {
        if (token) {
            axios
                .get("http://localhost:5000/users", { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => setUsers(res.data))
                .catch(console.error);
        }
    }, [token]);

    useEffect(() => {
        if (selectedUser) {
            axios
                .get(`http://localhost:5000/chats/${selectedUser.username}`, { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => setMessages(res.data))
                .catch(console.error);
        }
    }, [selectedUser, token]);

    useEffect(() => {
        const currentSocket = socketRef.current;
        currentSocket.on("receive_message", (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        });
        return () => {
            currentSocket.off("receive_message");
        };
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            socketRef.current.emit("join_room", username);
        }
    }, [isAuthenticated, username]);

    const handleAuth = async () => {
        const url = isLogin ? "/login" : "/signup";
        const payload = { username, password };
        try {
            const res = await axios.post(`https://chat-app-backend-production-4d1c.up.railway.app${url}`, payload);
            if (isLogin) {
                setToken(res.data.token);
                setIsAuthenticated(true);
            } else {
                alert("Signup successful! Please login.");
            }
        } catch (err) {
            alert(err.response?.data || "Authentication failed");
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!message.trim()) {
            alert("Message cannot be empty!");
            return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const data = {
            sender: username,
            receiver: selectedUser.username,
            message,
            timestamp,
        };

        socketRef.current.emit("send_message", data);
        setMessages((prev) => [...prev, data]);
        setMessage("");
    };

    return (
        <div className="h-screen w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-gray-900 font-sans">
            {!isAuthenticated ? (
                <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl shadow-2xl w-11/12 max-w-md mx-auto transition-all duration-500">
                    <h2 className="text-3xl font-extrabold mb-6 text-white text-center drop-shadow">
                        {isLogin ? "Welcome Back 👋" : "Create Account 🚀"}
                    </h2>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full p-3 mb-4 rounded-xl bg-white/20 text-white placeholder-white outline-none focus:ring-2 focus:ring-white transition"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 mb-4 rounded-xl bg-white/20 text-white placeholder-white outline-none focus:ring-2 focus:ring-white transition"
                    />
                    <button
                        onClick={handleAuth}
                        className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl hover:scale-105 transition duration-300"
                    >
                        {isLogin ? "Login" : "Signup"}
                    </button>
                    <p
                        className="text-center mt-4 text-white underline cursor-pointer hover:text-indigo-100 transition"
                        onClick={() => setIsLogin(!isLogin)}
                    >
                        {isLogin ? "Don't have an account? Signup" : "Already have an account? Login"}
                    </p>
                </div>
            ) : (
                <div className="flex w-full h-full max-h-screen overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-full md:w-1/4 bg-gray-900 text-white p-4 overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">📋 Chat Users</h3>
                        {users.map((user) => (
                            <div
                                key={user.username}
                                onClick={() => setSelectedUser(user)}
                                className={`p-3 rounded-xl mb-2 cursor-pointer transition-all ${
                                    selectedUser?.username === user.username
                                        ? "bg-indigo-600"
                                        : "hover:bg-gray-800"
                                }`}
                            >
                                {user.username}
                            </div>
                        ))}
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 bg-white p-6 flex flex-col">
                        {selectedUser ? (
                            <>
                                <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                                    {messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={`max-w-sm p-3 rounded-xl shadow-md transition transform ${
                                                msg.sender === username
                                                    ? "ml-auto bg-indigo-500 text-white animate-fadeInRight"
                                                    : "mr-auto bg-gray-200 text-black animate-fadeInLeft"
                                            }`}
                                        >
                                            <p className="font-semibold">{msg.sender}</p>
                                            <p>{msg.message}</p>
                                            <span className="text-xs block mt-1 opacity-70">{msg.timestamp}</span>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={sendMessage} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                                    />
                                    <button
                                        type="submit"
                                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition duration-300"
                                    >
                                        Send
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="text-center text-gray-400 mt-20 text-xl font-medium">
                                👈 Select a user to start chatting!
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;



/*import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:5000");

const Chat = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const socketRef = useRef(socket);

    // Fetch users after authentication
    useEffect(() => {
        if (token) {
            axios
                .get("http://localhost:5000/users", { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => setUsers(res.data))
                .catch(console.error);
        }
    }, [token]);

    // Fetch messages for selected user
    useEffect(() => {
        if (selectedUser) {
            axios
                .get(`http://localhost:5000/chats/${selectedUser.username}`, { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => setMessages(res.data))
                .catch(console.error);
        }
    }, [selectedUser, token]);

    // Set up socket listener
    useEffect(() => {
        const currentSocket = socketRef.current;

        currentSocket.on("receive_message", (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        });

        return () => {
            currentSocket.off("receive_message");
        };
    }, []);

    // Join room after successful authentication
    useEffect(() => {
        if (isAuthenticated) {
            socketRef.current.emit("join_room", username);
        }
    }, [isAuthenticated, username]);

    const handleAuth = async () => {
        const url = isLogin ? "/login" : "/signup";
        const payload = { username, password };
        try {
            const res = await axios.post(`http://localhost:5000${url}`, payload);
            if (isLogin) {
                setToken(res.data.token);
                setIsAuthenticated(true);
            } else {
                alert("Signup successful! Please login.");
            }
        } catch (err) {
            alert(err.response?.data || "Authentication failed");
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!message.trim()) {
            alert("Message cannot be empty!");
            return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const data = {
            sender: username,
            receiver: selectedUser.username,
            message,
            timestamp,
        };

        // Emit the message to the server
        socketRef.current.emit("send_message", data);

        // Update local messages
        setMessages((prev) => [...prev, data]);

        // Clear the input field
        setMessage("");
    };

    return (
        <div className="h-screen bg-gray-100 flex">
            {!isAuthenticated ? (
                <div className="w-full flex justify-center items-center">
                    <div className="bg-white p-6 rounded shadow-md">
                        <h2 className="text-xl font-bold mb-4">
                            {isLogin ? "Login" : "Signup"}
                        </h2>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-2 mb-4 border rounded"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 mb-4 border rounded"
                        />
                        <button
                            onClick={handleAuth}
                            className="w-full bg-blue-500 text-white p-2 rounded"
                        >
                            {isLogin ? "Login" : "Signup"}
                        </button>
                        <p
                            className="text-center mt-4 text-blue-500 cursor-pointer"
                            onClick={() => setIsLogin(!isLogin)}
                        >
                            {isLogin
                                ? "Don't have an account? Signup"
                                : "Already have an account? Login"}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex w-full">
                    <div className="w-1/4 bg-gray-800 p-4 text-white">
                        <h3 className="text-lg font-bold">Users</h3>
                        {users.map((user) => (
                            <div
                                key={user.username}
                                onClick={() => setSelectedUser(user)}
                                className={`p-3 cursor-pointer rounded ${
                                    selectedUser?.username === user.username
                                        ? "bg-gray-700"
                                        : "hover:bg-gray-700"
                                }`}
                            >
                                {user.username}
                            </div>
                        ))}
                    </div>
                    <div className="w-3/4 p-4 bg-white">
                        {selectedUser && (
                            <>
                                <div className="h-96 overflow-y-auto bg-gray-50 p-4 shadow-inner">
                                    {messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={`p-3 rounded ${
                                                msg.sender === username
                                                    ? "bg-blue-500 text-white text-right"
                                                    : "bg-gray-300 text-black text-left"
                                            } mb-3`}
                                        >
                                            <p>
                                                <strong>{msg.sender}</strong>:
                                            </p>
                                            <p>{msg.message}</p>
                                            <span className="text-xs">
                                                {msg.timestamp}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={sendMessage} className="mt-4 flex">
                                    <input
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Type a message"
                                        className="flex-1 p-3 border rounded"
                                    />
                                    <button
                                        type="submit"
                                        className="bg-blue-500 text-white px-4 py-2 ml-2 rounded"
                                    >
                                        Send
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;*/







