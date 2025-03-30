import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { FaArrowLeft, FaPaperPlane, FaCircle, FaCheck, FaCheckDouble } from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";

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
    const [loading, setLoading] = useState({
        auth: false,
        users: false,
        messages: false
    });
    const [error, setError] = useState("");
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    // Initialize socket connection
    useEffect(() => {
        if (isAuthenticated) {
            const newSocket = io("http://localhost:5000", {
                auth: { token },
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });
            socketRef.current = newSocket;

            return () => {
                newSocket.disconnect();
            };
        }
    }, [isAuthenticated, token]);

    // Join room when authenticated
    useEffect(() => {
        if (isAuthenticated && socketRef.current) {
            socketRef.current.emit("join_room", username);
        }
    }, [isAuthenticated, username]);

    // Fetch users
    useEffect(() => {
        if (token) {
            setLoading(prev => ({ ...prev, users: true }));
            axios.get("http://localhost:5000/users", { 
                headers: { Authorization: `Bearer ${token}` } 
            })
            .then((res) => setUsers(res.data))
            .catch(err => {
                setError("Failed to load users");
                console.error(err);
            })
            .finally(() => setLoading(prev => ({ ...prev, users: false })));
        }
    }, [token]);

    // Fetch messages when user is selected
    useEffect(() => {
        if (selectedUser && token) {
            setLoading(prev => ({ ...prev, messages: true }));
            setMessages([]);
            axios.get(`http://localhost:5000/chats/${selectedUser.username}`, { 
                headers: { Authorization: `Bearer ${token}` } 
            })
            .then((res) => {
                setMessages(res.data);
                markMessagesAsRead(res.data);
            })
            .catch(err => {
                setError("Failed to load messages");
                console.error(err);
            })
            .finally(() => setLoading(prev => ({ ...prev, messages: false })));
        }
    }, [selectedUser, token]);

    // Socket event listeners
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const handleReceiveMessage = (newMessage) => {
            setMessages(prev => [...prev, newMessage]);
            
            // If message is for current chat and from selected user, mark as read
            if (selectedUser && newMessage.sender === selectedUser.username) {
                markMessagesAsRead([newMessage]);
            }
        };

        const handleMessagesRead = ({ messageIds }) => {
            setMessages(prev => 
                prev.map(msg => 
                    messageIds.includes(msg._id) ? { ...msg, read: true } : msg
                )
            );
        };

        socket.on("receive_message", handleReceiveMessage);
        socket.on("messages_read", handleMessagesRead);

        return () => {
            socket.off("receive_message", handleReceiveMessage);
            socket.off("messages_read", handleMessagesRead);
        };
    }, [selectedUser]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const markMessagesAsRead = useCallback((messagesToMark) => {
        const unreadMessages = messagesToMark.filter(
            msg => msg.sender === selectedUser?.username && !msg.read
        );
        
        if (unreadMessages.length > 0 && socketRef.current) {
            const messageIds = unreadMessages.map(msg => msg._id);
            socketRef.current.emit("mark_as_read", {
                messageIds,
                sender: username,
                receiver: selectedUser.username
            });
        }
    }, [selectedUser, username]);

    const handleAuth = async () => {
        setError("");
        setLoading(prev => ({ ...prev, auth: true }));
        
        const url = isLogin ? "/login" : "/signup";
        const payload = { username, password };
        
        try {
            const res = await axios.post(`http://localhost:5000${url}`, payload);
            if (isLogin) {
                setToken(res.data.token);
                setIsAuthenticated(true);
            } else {
                alert("Signup successful! Please login.");
                setIsLogin(true);
                setUsername("");
                setPassword("");
            }
        } catch (err) {
            setError(err.response?.data?.error || 
                (isLogin ? "Login failed" : "Signup failed"));
        } finally {
            setLoading(prev => ({ ...prev, auth: false }));
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || !selectedUser || !socketRef.current) return;

        const content = message.trim();
        setMessage("");

        try {
            const newMessage = {
                sender: username,
                receiver: selectedUser.username,
                content,
                timestamp: new Date().toISOString()
            };

            socketRef.current.emit("send_message", newMessage);
        } catch (err) {
            setError("Failed to send message");
            console.error(err);
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    };

    const isSameDay = (date1, date2) => {
        return (
            date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate()
        );
    };

    const getLastSeenStatus = (user) => {
        if (!user.lastSeen) return "Never active";
        
        const lastSeen = new Date(user.lastSeen);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        
        if (diffMinutes < 1) return "Online now";
        if (diffMinutes < 60) return `Active ${diffMinutes} min ago`;
        if (isSameDay(lastSeen, now)) return `Active today at ${formatTime(lastSeen)}`;
        
        return `Active on ${formatDate(lastSeen)}`;
    };

    return (
        <div className="h-screen w-full bg-gray-950 flex items-center justify-center text-white font-sans">
            {!isAuthenticated ? (
                <div className="bg-gray-900 p-8 rounded-3xl shadow-2xl w-11/12 max-w-md mx-auto transition-all">
                    <h2 className="text-3xl font-extrabold mb-6 text-center">
                        {isLogin ? "Welcome Back 👋" : "Create Account 🚀"}
                    </h2>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-500 rounded-lg text-center">
                            {error}
                        </div>
                    )}
                    
                    <input 
                        type="text" 
                        placeholder="Username" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full p-3 mb-4 rounded-xl bg-gray-800 text-white outline-none focus:ring-2 focus:ring-indigo-400" 
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 mb-4 rounded-xl bg-gray-800 text-white outline-none focus:ring-2 focus:ring-indigo-400" 
                    />
                    <button 
                        onClick={handleAuth} 
                        disabled={loading.auth}
                        className="w-full bg-indigo-600 py-3 rounded-xl hover:scale-105 transition flex items-center justify-center gap-2"
                    >
                        {loading.auth ? (
                            <>
                                <ImSpinner8 className="animate-spin" />
                                {isLogin ? "Logging in..." : "Signing up..."}
                            </>
                        ) : isLogin ? "Login" : "Signup"}
                    </button>
                    <p className="text-center mt-4 underline cursor-pointer hover:text-indigo-400" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? "Don't have an account? Signup" : "Already have an account? Login"}
                    </p>
                </div>
            ) : (
                <div className="w-full h-full flex">
                    {!selectedUser ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="bg-gray-800 p-8 rounded-xl w-96 max-h-[80vh] overflow-y-auto">
                                <h3 className="text-xl font-bold mb-4 text-center">📋 Chat Users</h3>
                                {loading.users ? (
                                    <div className="flex justify-center py-8">
                                        <ImSpinner8 className="animate-spin text-2xl" />
                                    </div>
                                ) : users.length === 0 ? (
                                    <p className="text-center text-gray-400">No other users found</p>
                                ) : (
                                    users.map((user) => (
                                        <div 
                                            key={user.username} 
                                            onClick={() => setSelectedUser(user)}
                                            className="p-3 rounded-xl cursor-pointer hover:bg-indigo-600 transition flex justify-between items-center"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                                                        {user.profilePicture ? (
                                                            <img 
                                                                src={user.profilePicture} 
                                                                alt={user.username}
                                                                className="w-full h-full rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            user.username.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    {getLastSeenStatus(user).includes("Online") && (
                                                        <FaCircle className="absolute bottom-0 right-0 text-green-500 text-xs" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{user.username}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {getLastSeenStatus(user)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col bg-gray-900">
                            <div className="flex items-center p-4 bg-gray-800 shadow-md">
                                <button 
                                    onClick={() => setSelectedUser(null)}
                                    className="p-2 rounded-full hover:bg-gray-700 transition"
                                >
                                    <FaArrowLeft className="text-xl" />
                                </button>
                                <div className="ml-4 flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                                            {selectedUser.profilePicture ? (
                                                <img 
                                                    src={selectedUser.profilePicture} 
                                                    alt={selectedUser.username}
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                selectedUser.username.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        {getLastSeenStatus(selectedUser).includes("Online") && (
                                            <FaCircle className="absolute bottom-0 right-0 text-green-500 text-xs" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold">{selectedUser.username}</h3>
                                        <p className="text-xs text-gray-400">
                                            {getLastSeenStatus(selectedUser)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6">
                                {loading.messages ? (
                                    <div className="flex justify-center items-center h-full">
                                        <ImSpinner8 className="animate-spin text-2xl" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <p>No messages yet</p>
                                        <p className="text-sm mt-2">Start the conversation!</p>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => {
                                        const isMe = msg.sender === username;
                                        const showDate = i === 0 || 
                                            !isSameDay(new Date(msg.timestamp), new Date(messages[i-1].timestamp));
                                        
                                        return (
                                            <React.Fragment key={msg._id || i}>
                                                {showDate && (
                                                    <div className="text-center my-4 text-xs text-gray-500">
                                                        {formatDate(msg.timestamp)}
                                                    </div>
                                                )}
                                                <div 
                                                    className={`max-w-xs p-3 rounded-xl shadow-md mb-3 ${
                                                        isMe ? "ml-auto bg-indigo-500" : "mr-auto bg-gray-700"
                                                    }`}
                                                >
                                                    {!isMe && (
                                                        <p className="font-semibold text-sm">{msg.sender}</p>
                                                    )}
                                                    <p>{msg.content}</p>
                                                    <div className="flex items-center justify-end gap-1 mt-1">
                                                        <span className="text-xs opacity-70">
                                                            {formatTime(msg.timestamp)}
                                                        </span>
                                                        {isMe && (
                                                            msg.read ? (
                                                                <FaCheckDouble className="text-xs text-blue-300" />
                                                            ) : (
                                                                <FaCheck className="text-xs text-gray-300" />
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            
                            <form onSubmit={sendMessage} className="p-4 flex gap-2 bg-gray-800">
                                <input 
                                    type="text" 
                                    value={message} 
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type a message..." 
                                    className="flex-1 p-3 rounded-xl bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                                    maxLength="1000"
                                />
                                <button 
                                    type="submit" 
                                    disabled={!message.trim()}
                                    className="bg-indigo-600 p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    <FaPaperPlane className="text-xl" />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Chat;



/*import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { FaArrowLeft, FaPaperPlane } from "react-icons/fa";

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
            axios.get("http://localhost:5000/users", { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => setUsers(res.data))
                .catch(console.error);
        }
    }, [token]);

    useEffect(() => {
        if (selectedUser) {
            axios.get(`http://localhost:5000/chats/${selectedUser.username}`, { headers: { Authorization: `Bearer ${token}` } })
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
        if (!message.trim()) return;

        const timestamp = new Date().toLocaleTimeString();
        const data = { sender: username, receiver: selectedUser.username, message, timestamp };

        socketRef.current.emit("send_message", data);
        setMessages((prev) => [...prev, data]);
        setMessage("");
    };

    return (
        <div className="h-screen w-full bg-gray-950 flex items-center justify-center text-white font-sans">
            {!isAuthenticated ? (
                <div className="bg-gray-900 p-8 rounded-3xl shadow-2xl w-11/12 max-w-md mx-auto transition-all">
                    <h2 className="text-3xl font-extrabold mb-6 text-center">
                        {isLogin ? "Welcome Back 👋" : "Create Account 🚀"}
                    </h2>
                    <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
                        className="w-full p-3 mb-4 rounded-xl bg-gray-800 text-white outline-none focus:ring-2 focus:ring-indigo-400" />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 mb-4 rounded-xl bg-gray-800 text-white outline-none focus:ring-2 focus:ring-indigo-400" />
                    <button onClick={handleAuth} className="w-full bg-indigo-600 py-3 rounded-xl hover:scale-105 transition">
                        {isLogin ? "Login" : "Signup"}
                    </button>
                    <p className="text-center mt-4 underline cursor-pointer" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? "Don't have an account? Signup" : "Already have an account? Login"}
                    </p>
                </div>
            ) : (
                <div className="w-full h-full flex">
                    {!selectedUser ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="bg-gray-800 p-8 rounded-xl w-96">
                                <h3 className="text-xl font-bold mb-4 text-center">📋 Chat Users</h3>
                                {users.map((user) => (
                                    <div key={user.username} onClick={() => setSelectedUser(user)}
                                        className="p-3 rounded-xl cursor-pointer hover:bg-indigo-600 transition">
                                        {user.username}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col bg-gray-900">
                            <div className="flex items-center p-4 bg-gray-800 shadow-md">
                                <FaArrowLeft className="cursor-pointer text-2xl" onClick={() => setSelectedUser(null)} />
                                <h3 className="text-xl font-bold ml-4">{selectedUser.username}</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                {messages.map((msg, i) => (
                                    <div key={i} className={`max-w-xs p-3 rounded-xl shadow-md mb-3 ${msg.sender === username ? "ml-auto bg-indigo-500" : "mr-auto bg-gray-700"}`}>
                                        <p className="font-semibold">{msg.sender}</p>
                                        <p>{msg.message}</p>
                                        <span className="text-xs block mt-1 opacity-70">{msg.timestamp}</span>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={sendMessage} className="p-4 flex gap-2 bg-gray-800">
                                <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type a message..." className="flex-1 p-3 rounded-xl bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                <button type="submit" className="bg-indigo-600 p-3 rounded-xl hover:bg-indigo-700">
                                    <FaPaperPlane className="text-xl" />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Chat;
*/



