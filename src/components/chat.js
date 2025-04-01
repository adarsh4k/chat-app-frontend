import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { 
  FaArrowLeft, FaPaperPlane, FaSignOutAlt, FaCircle, FaCheck, 
  FaCheckDouble, FaSearch, FaEllipsisH, FaSmile, FaTrash, FaEdit,
  FaTimes
} from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";
import EmojiPicker from "emoji-picker-react"; // You'll need to install this package

// Notification sound
const notificationSound = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-soft-ting-aliarm-3971.mp3");

const Chat = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("chatToken") || "");
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);
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
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Check for notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Play sound for new messages
  const playNotificationSound = () => {
    try {
      notificationSound.currentTime = 0;
      notificationSound.play().catch(e => console.log("Audio play failed:", e));
    } catch (e) {
      console.log("Notification sound error:", e);
    }
  };

  // Show desktop notification
  const showDesktopNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated) {
      const newSocket = io("https://chat-app-backend-xb3j.onrender.com", {
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
      axios.get("https://chat-app-backend-xb3j.onrender.com/users", { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      .then((res) => setUsers(res.data))
      .catch(err => {
        if (err.response?.status === 401) {
          handleLogout();
        }
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
      axios.get(`https://chat-app-backend-xb3j.onrender.com/chats/${selectedUser.username}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      .then((res) => {
        setMessages(res.data);
        markMessagesAsRead(res.data);
      })
      .catch(err => {
        if (err.response?.status === 401) {
          handleLogout();
        }
        setError("Failed to load messages");
        console.error(err);
      })
      .finally(() => setLoading(prev => ({ ...prev, messages: false })));
    }
  }, [selectedUser, token]);

  // Update unread counts periodically
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      if (token) {
        try {
          const res = await axios.get("https://chat-app-backend-xb3j.onrender.com/unread-counts", { 
            headers: { Authorization: `Bearer ${token}` } 
          });
          setUnreadCounts(res.data);
        } catch (err) {
          console.error("Failed to fetch unread counts:", err);
        }
      }
    };
    
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [token]);

  // Socket event listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleReceiveMessage = (newMessage) => {
      setMessages(prev => [...prev, newMessage]);
      
      // Play sound and show notification if not focused on chat with sender
      if (!selectedUser || selectedUser.username !== newMessage.sender) {
        playNotificationSound();
        showDesktopNotification(
          `New message from ${newMessage.sender}`,
          newMessage.content.length > 30 
            ? `${newMessage.content.substring(0, 30)}...` 
            : newMessage.content
        );
        
        // Update unread counts
        setUnreadCounts(prev => ({
          ...prev,
          [newMessage.sender]: (prev[newMessage.sender] || 0) + 1
        }));
      }
      
      if (selectedUser && newMessage.sender === selectedUser.username) {
        markMessagesAsRead([newMessage]);
      }
    };
    
    const handleUserStatus = ({ username, isOnline }) => {
      setUsers(prev => 
        prev.map(user => 
          user.username === username 
            ? { ...user, isOnline } 
            : user
        )
      );
      
      if (selectedUser?.username === username) {
        setSelectedUser(prev => ({ ...prev, isOnline }));
      }
    };
    
    const handleTyping = ({ from, isTyping }) => {
      setTypingUsers(prev => ({
        ...prev,
        [from]: isTyping
      }));
    };
    
    const handleMessageReacted = ({ messageId, reactions }) => {
      setMessages(prev => 
        prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, reactions: new Map(Object.entries(reactions)) } 
            : msg
        )
      );
    };
    
    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => 
        prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, deleted: true } 
            : msg
        )
      );
    };
    
    const handleMessageEdited = ({ messageId, newContent, edited }) => {
      setMessages(prev => 
        prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, content: newContent, edited } 
            : msg
        )
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_status", handleUserStatus);
    socket.on("typing", handleTyping);
    socket.on("message_reacted", handleMessageReacted);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_status", handleUserStatus);
      socket.off("typing", handleTyping);
      socket.off("message_reacted", handleMessageReacted);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
    };
  }, [selectedUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Set username from localStorage if available
  useEffect(() => {
    const savedUsername = localStorage.getItem("chatUsername");
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

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
      
      // Update unread counts
      setUnreadCounts(prev => ({
        ...prev,
        [selectedUser.username]: 0
      }));
    }
  }, [selectedUser, username]);

  // Typing indicator handler
  const handleTyping = useCallback(
    (isTyping) => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (socketRef.current && selectedUser) {
        socketRef.current.emit("typing", {
          isTyping,
          to: selectedUser.username
        });
        
        if (isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current) {
              socketRef.current.emit("typing", {
                isTyping: false,
                to: selectedUser.username
              });
            }
          }, 3000);
        }
      }
    },
    [selectedUser]
  );

  const handleAuth = async () => {
    setError("");
    setLoading(prev => ({ ...prev, auth: true }));
    
    const url = isLogin ? "/login" : "/signup";
    const payload = { username, password };
    
    try {
      const res = await axios.post(`https://chat-app-backend-xb3j.onrender.com${url}`, payload);
      if (isLogin) {
        const { token } = res.data;
        setToken(token);
        localStorage.setItem("chatToken", token);
        localStorage.setItem("chatUsername", username);
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

  const handleLogout = () => {
    localStorage.removeItem("chatToken");
    localStorage.removeItem("chatUsername");
    setToken("");
    setIsAuthenticated(false);
    setSelectedUser(null);
    setMessages([]);
    if (socketRef.current) {
      socketRef.current.disconnect();
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
      handleTyping(false);
    } catch (err) {
      setError("Failed to send message");
      console.error(err);
    }
  };

  // Message reaction handler
  const handleReactToMessage = (messageId, emoji) => {
    if (socketRef.current) {
      socketRef.current.emit("react_to_message", { messageId, emoji });
      setShowEmojiPicker(false);
    }
  };

  // Message deletion handler
  const handleDeleteMessage = (messageId) => {
    if (socketRef.current && window.confirm("Are you sure you want to delete this message?")) {
      socketRef.current.emit("delete_message", { messageId });
    }
  };

  // Message editing handler
  const handleEditMessage = (messageId, newContent) => {
    if (socketRef.current) {
      socketRef.current.emit("edit_message", { messageId, newContent });
      setEditingMessage(null);
    }
  };

  // Search messages handler
  const handleSearchMessages = async () => {
    if (!selectedUser || !searchQuery.trim()) return;
    
    try {
      const res = await axios.get("https://chat-app-backend-xb3j.onrender.com/search-messages", {
        params: { query: searchQuery, withUser: selectedUser.username },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchResults(res.data);
      setShowSearchResults(true);
    } catch (err) {
      console.error("Search failed:", err);
      setError("Search failed");
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
    
    if (user.isOnline) return "Online now";
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `Active ${diffMinutes} min ago`;
    if (isSameDay(lastSeen, now)) return `Active today at ${formatTime(lastSeen)}`;
    
    return `Active on ${formatDate(lastSeen)}`;
  };

  const renderMessage = (msg, i) => {
    if (msg.deleted) {
      return (
        <div key={msg._id || i} className="max-w-xs p-3 rounded-xl shadow-md mb-3 mx-auto bg-gray-800 italic text-gray-400">
          Message deleted
        </div>
      );
    }
    
    const isMe = msg.sender === username;
    const showDate = i === 0 || 
      !isSameDay(new Date(msg.timestamp), new Date(messages[i-1]?.timestamp || 0));

    return (
      <React.Fragment key={msg._id || i}>
        {showDate && (
          <div className="text-center my-4 text-xs text-gray-500">
            {formatDate(msg.timestamp)}
          </div>
        )}
        <div 
          className={`max-w-xs p-3 rounded-xl shadow-md mb-3 relative group ${
            isMe ? "ml-auto bg-indigo-500" : "mr-auto bg-gray-700"
          }`}
        >
          {!isMe && (
            <p className="font-semibold text-sm">{msg.sender}</p>
          )}
          <p>{msg.content}</p>
          
          {/* Message status and timestamp */}
          <div className="flex items-center justify-end gap-1 mt-1">
            {msg.edited && (
              <span className="text-xs opacity-50 mr-1">(edited)</span>
            )}
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
          
          {/* Message actions (hover) */}
          <div className={`absolute ${isMe ? '-left-10' : '-right-10'} top-0 opacity-0 group-hover:opacity-100 transition flex gap-1`}>
            {isMe && (
              <>
                <button 
                  onClick={() => setEditingMessage(msg)}
                  className="p-1 rounded-full hover:bg-gray-600"
                >
                  <FaEdit className="text-xs" />
                </button>
                <button 
                  onClick={() => handleDeleteMessage(msg._id)}
                  className="p-1 rounded-full hover:bg-gray-600"
                >
                  <FaTrash className="text-xs" />
                </button>
              </>
            )}
            <button 
              onClick={() => setShowEmojiPicker(msg._id)}
              className="p-1 rounded-full hover:bg-gray-600"
            >
              <FaSmile className="text-xs" />
            </button>
          </div>
          
          {/* Reactions */}
          {msg.reactions && msg.reactions.size > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {Array.from(msg.reactions.entries()).map(([user, emoji]) => (
                <span 
                  key={`${msg._id}-${user}`} 
                  className="text-xs bg-gray-800 rounded-full px-1"
                  title={user}
                >
                  {emoji}
                </span>
              ))}
            </div>
          )}
          
          {/* Emoji picker */}
          {showEmojiPicker === msg._id && (
            <div className="absolute z-10">
              <EmojiPicker 
                onEmojiClick={(emojiData) => handleReactToMessage(msg._id, emojiData.emoji)}
                width={300}
                height={350}
              />
              <button 
                onClick={() => setShowEmojiPicker(false)}
                className="absolute top-0 right-0 p-1 bg-gray-700 rounded-full"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
          )}
        </div>
      </React.Fragment>
    );
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
            <div className="flex-1 flex flex-col">
              <div className="p-4 bg-gray-800 shadow-md flex justify-between items-center">
                <h3 className="text-xl font-bold">📋 Chat Users</h3>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition"
                >
                  <FaSignOutAlt /> Logout
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading.users ? (
                  <div className="flex justify-center py-8">
                    <ImSpinner8 className="animate-spin text-2xl" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-center text-gray-400 mt-8">No other users found</p>
                ) : (
                  users.map((user) => (
                    <div 
                      key={user.username} 
                      onClick={() => setSelectedUser(user)}
                      className="p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition flex justify-between items-center"
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
                          {user.isOnline && (
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
                      {unreadCounts[user.username] > 0 && (
                        <span className="ml-auto bg-indigo-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {unreadCounts[user.username]}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-gray-900">
              <div className="flex items-center p-4 bg-gray-800 shadow-md">
                <button 
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery("");
                    setShowSearchResults(false);
                  }}
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
                    {selectedUser.isOnline && (
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
                <div className="relative ml-4">
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchMessages()}
                    className="bg-gray-700 text-white px-3 py-1 rounded-lg text-sm w-40 focus:outline-none"
                  />
                  <FaSearch 
                    className="absolute right-2 top-2 text-gray-400 cursor-pointer" 
                    onClick={handleSearchMessages}
                  />
                </div>
                <button 
                  onClick={handleLogout}
                  className="ml-auto flex items-center gap-2 bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition"
                >
                  <FaSignOutAlt /> Logout
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {loading.messages ? (
                  <div className="flex justify-center items-center h-full">
                    <ImSpinner8 className="animate-spin text-2xl" />
                  </div>
                ) : showSearchResults ? (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold">Search Results</h4>
                      <button 
                        onClick={() => setShowSearchResults(false)}
                        className="text-sm text-indigo-400"
                      >
                        Back to chat
                      </button>
                    </div>
                    {searchResults.length === 0 ? (
                      <p className="text-center text-gray-500">No results found</p>
                    ) : (
                      searchResults.map(renderMessage)
                    )}
                  </>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p>No messages yet</p>
                    <p className="text-sm mt-2">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map(renderMessage)
                )}
                
                {/* Typing indicator */}
                {typingUsers[selectedUser.username] && (
                  <div className="max-w-xs p-2 rounded-xl shadow-md mb-3 mr-auto bg-gray-800">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={sendMessage} className="p-4 flex gap-2 bg-gray-800">
                <input 
                  type="text" 
                  value={message} 
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTyping(e.target.value.length > 0);
                  }}
                  placeholder="Type a message..." 
                  className="flex-1 p-3 rounded-xl bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                  maxLength="1000"
                />
                <button 
                  type="button"
                  onClick={() => setShowEmojiPicker("new")}
                  className="bg-gray-700 p-3 rounded-xl hover:bg-gray-600 transition"
                >
                  <FaSmile className="text-xl" />
                </button>
                <button 
                  type="submit" 
                  disabled={!message.trim()}
                  className="bg-indigo-600 p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <FaPaperPlane className="text-xl" />
                </button>
              </form>
              
              {/* Emoji picker for new message */}
              {showEmojiPicker === "new" && (
                <div className="absolute bottom-16 right-4">
                  <EmojiPicker 
                    onEmojiClick={(emojiData) => {
                      setMessage(prev => prev + emojiData.emoji);
                      setShowEmojiPicker(false);
                    }}
                    width={300}
                    height={350}
                  />
                  <button 
                    onClick={() => setShowEmojiPicker(false)}
                    className="absolute top-0 right-0 p-1 bg-gray-700 rounded-full"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Edit message modal */}
          {editingMessage && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-800 p-6 rounded-xl max-w-md w-full">
                <h3 className="text-lg font-bold mb-4">Edit Message</h3>
                <textarea
                  value={editingMessage.content}
                  onChange={(e) => setEditingMessage({
                    ...editingMessage,
                    content: e.target.value
                  })}
                  className="w-full p-3 rounded-lg bg-gray-700 text-white mb-4"
                  rows="3"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingMessage(null)}
                    className="px-4 py-2 bg-gray-600 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEditMessage(editingMessage._id, editingMessage.content)}
                    className="px-4 py-2 bg-indigo-600 rounded-lg"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;


/*import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { FaArrowLeft, FaPaperPlane, FaSignOutAlt, FaCircle, FaCheck, FaCheckDouble } from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";

const Chat = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState(localStorage.getItem("chatToken") || "");
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("chatToken"));
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
                if (err.response?.status === 401) {
                    handleLogout();
                }
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
                if (err.response?.status === 401) {
                    handleLogout();
                }
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
                const { token } = res.data;
                setToken(token);
                localStorage.setItem("chatToken", token);
                localStorage.setItem("chatUsername", username);
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

    const handleLogout = () => {
        localStorage.removeItem("chatToken");
        localStorage.removeItem("chatUsername");
        setToken("");
        setIsAuthenticated(false);
        setSelectedUser(null);
        setMessages([]);
        if (socketRef.current) {
            socketRef.current.disconnect();
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

    // Set username from localStorage if available
    useEffect(() => {
        const savedUsername = localStorage.getItem("chatUsername");
        if (savedUsername) {
            setUsername(savedUsername);
        }
    }, []);

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
                        <div className="flex-1 flex flex-col">
                            <div className="p-4 bg-gray-800 shadow-md flex justify-between items-center">
                                <h3 className="text-xl font-bold">📋 Chat Users</h3>
                                <button 
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition"
                                >
                                    <FaSignOutAlt /> Logout
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {loading.users ? (
                                    <div className="flex justify-center py-8">
                                        <ImSpinner8 className="animate-spin text-2xl" />
                                    </div>
                                ) : users.length === 0 ? (
                                    <p className="text-center text-gray-400 mt-8">No other users found</p>
                                ) : (
                                    users.map((user) => (
                                        <div 
                                            key={user.username} 
                                            onClick={() => setSelectedUser(user)}
                                            className="p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition flex justify-between items-center"
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
                                <button 
                                    onClick={handleLogout}
                                    className="ml-auto flex items-center gap-2 bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition"
                                >
                                    <FaSignOutAlt /> Logout
                                </button>
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

export default Chat;*/





