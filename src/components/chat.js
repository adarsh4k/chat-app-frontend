import React, { useState, useEffect } from 'react';
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

export default Chat;