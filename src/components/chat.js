import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("https://chat-app-backend-xb3j.onrender.com"); 

const Chat = () => {
    const [username, setUsername] = useState("");
    const [profilePicture, setProfilePicture] = useState(null);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isUsernameSet, setIsUsernameSet] = useState(false);

    const handleSetUsername = () => {
        if (username.trim()) {
            socket.emit("set_username", { username, profilePicture });
            setIsUsernameSet(true);
        }
    };

    const handleProfilePictureUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePicture(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim()) {
            const timestamp = new Date().toLocaleTimeString();
            socket.emit("send_message", { username, profilePicture, message, timestamp });
            setMessage("");
        }
    };

    useEffect(() => {
        socket.on("receive_message", (data) => {
            setMessages((prev) => [...prev, data]);
        });

        socket.on("user_typing", (data) => {
            setIsTyping(data.isTyping && data.username !== username);
        });

        return () => {
            socket.off("receive_message");
            socket.off("user_typing");
        };
    }, [username]);

    const handleTyping = (e) => {
        setMessage(e.target.value);
        socket.emit("user_typing", { username, isTyping: e.target.value.length > 0 });
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-r from-indigo-600 to-purple-700 p-6">
            {!isUsernameSet ? (
                <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8 space-y-6 transform transition-all duration-300 ease-in-out">
                    <h2 className="text-center text-2xl font-semibold text-gray-800">Welcome to Chat</h2>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full p-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex justify-center items-center">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePictureUpload}
                            className="mt-4 bg-gray-100 p-2 rounded-lg cursor-pointer"
                        />
                    </div>
                    <button
                        onClick={handleSetUsername}
                        className="w-full py-3 mt-6 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                    >
                        Set Username
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-lg bg-white shadow-xl rounded-xl p-6 space-y-6">
                    <div className="h-96 overflow-y-auto border-b-2 border-gray-200 mb-4 space-y-6 p-4">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex items-start space-x-3 ${
                                    msg.username === username ? "justify-end" : "justify-start"
                                }`}
                            >
                                {/* Profile picture on the left for other users, on the right for self */}
                                {msg.username !== username && msg.profilePicture && (
                                    <img
                                        src={msg.profilePicture}
                                        alt="Profile"
                                        className="w-12 h-12 rounded-full border-2 border-indigo-500"
                                    />
                                )}
                                <div
                                    className={`max-w-xs p-4 rounded-2xl ${
                                        msg.username === username
                                            ? "bg-indigo-600 text-white text-right shadow-md"
                                            : "bg-gray-200 text-gray-800 text-left shadow-md"
                                    }`}
                                >
                                    <div className="text-sm text-gray-500 font-medium">
                                        {msg.username === username ? "You" : msg.username}
                                    </div>
                                    <div className="mt-2 text-lg font-semibold">
                                        {msg.message}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-400">{msg.timestamp}</div>
                                </div>
                                {/* Profile picture on the right for self */}
                                {msg.username === username && msg.profilePicture && (
                                    <img
                                        src={msg.profilePicture}
                                        alt="Profile"
                                        className="w-12 h-12 rounded-full border-2 border-indigo-500"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    {isTyping && (
                        <div className="text-sm text-indigo-400 italic">User is typing...</div>
                    )}
                    <form onSubmit={sendMessage} className="flex items-center space-x-4">
                        <input
                            type="text"
                            value={message}
                            onChange={handleTyping}
                            placeholder="Type a message"
                            className="flex-1 p-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            type="submit"
                            className="bg-indigo-600 text-white py-3 px-6 rounded-full hover:bg-indigo-700 transition-all"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Chat;




/*import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000"); // Replace with your backend URL

const Chat = () => {
    const [username, setUsername] = useState("");
    const [profilePicture, setProfilePicture] = useState(null);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isUsernameSet, setIsUsernameSet] = useState(false);

    const handleSetUsername = () => {
        if (username.trim()) {
            socket.emit("set_username", { username, profilePicture });
            setIsUsernameSet(true);
        }
    };

    const handleProfilePictureUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePicture(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim()) {
            const timestamp = new Date().toLocaleTimeString();
            socket.emit("send_message", { username, profilePicture, message, timestamp });
            setMessage("");
        }
    };

    useEffect(() => {
        socket.on("receive_message", (data) => {
            setMessages((prev) => [...prev, data]);
        });

        socket.on("user_typing", (data) => {
            setIsTyping(data.isTyping && data.username !== username);
        });

        return () => {
            socket.off("receive_message");
            socket.off("user_typing");
        };
    }, [username]);

    const handleTyping = (e) => {
        setMessage(e.target.value);
        socket.emit("user_typing", { username, isTyping: e.target.value.length > 0 });
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            {!isUsernameSet ? (
                <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-4">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full p-2 border rounded-lg focus:outline-none"
                    />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureUpload}
                        className="mt-4"
                    />
                    <button
                        onClick={handleSetUsername}
                        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                    >
                        Set Username
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-4">
                    <div className="h-80 overflow-y-auto border-b border-gray-200 mb-4">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex items-center my-2 ${
                                    msg.username === username ? "justify-end" : "justify-start"
                                }`}
                            >
                                {msg.username !== username && msg.profilePicture && (
                                    <img
                                        src={msg.profilePicture}
                                        alt="Profile"
                                        className="w-8 h-8 rounded-full mr-2"
                                    />
                                )}
                                <div
                                    className={`px-3 py-2 rounded-lg ${
                                        msg.username === username
                                            ? "bg-blue-100 text-right ml-auto"
                                            : "bg-gray-100 text-left mr-auto"
                                    }`}
                                >
                                    <div className="text-sm text-gray-500">
                                        {msg.username === username ? "You" : msg.username}
                                    </div>
                                    <div className="text-gray-800">{msg.message}</div>
                                    <div className="text-xs text-gray-400 mt-1">{msg.timestamp}</div>
                                </div>
                                {msg.username === username && msg.profilePicture && (
                                    <img
                                        src={msg.profilePicture}
                                        alt="Profile"
                                        className="w-8 h-8 rounded-full ml-2"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    {isTyping && <div className="text-sm text-gray-500 mb-2">User is typing...</div>}
                    <form onSubmit={sendMessage} className="flex">
                        <input
                            type="text"
                            value={message}
                            onChange={handleTyping}
                            placeholder="Type a message"
                            className="flex-1 p-2 border rounded-l-lg focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="bg-blue-500 text-white px-4 rounded-r-lg hover:bg-blue-600"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Chat;*/





/*import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000'); // Backend URL

const Chat = () => {
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isUsernameSet, setIsUsernameSet] = useState(false);


    const handleSetUsername = () => {
        if (username.trim()) {
            socket.emit('set_username', username);
            setIsUsernameSet(true);
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim()) {
            socket.emit('send_message', message);
            setMessage('');
        }
    };

    useEffect(() => {
        socket.on('receive_message', (data) => {
            setMessages((prev) => [...prev, data]);
        });

        return () => {
            socket.off('receive_message');
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            {!isUsernameSet ? (
                <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-4">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full p-2 border rounded-lg focus:outline-none"
                    />
                    <button
                        onClick={handleSetUsername}
                        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                    >
                        Set Username
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-4">
                    <div className="h-80 overflow-y-auto border-b border-gray-200 mb-4">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`my-2 px-3 py-2 rounded-lg ${
                                    msg.username === username
                                        ? 'bg-blue-100 text-right ml-auto'
                                        : 'bg-gray-100 text-left mr-auto'
                                }`}
                            >
                                <div className="text-sm text-gray-500">
                                    {msg.username === username ? 'You' : msg.username}
                                </div>
                                <div className="text-gray-800">{msg.message}</div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={sendMessage} className="flex">
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type a message"
                            className="flex-1 p-2 border rounded-l-lg focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="bg-blue-500 text-white px-4 rounded-r-lg hover:bg-blue-600"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Chat;*/