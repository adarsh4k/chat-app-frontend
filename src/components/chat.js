import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { 
  FaArrowLeft, FaPaperPlane, FaSignOutAlt, FaCircle, FaCheck, 
  FaCheckDouble, FaSearch, FaEllipsisH, FaSmile, FaTrash, FaEdit,
  FaTimes, FaUserFriends, FaRegComment, FaMoon, FaSun
} from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";
import EmojiPicker from "emoji-picker-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [darkMode, setDarkMode] = useState(true);
  
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const playNotificationSound = () => {
    try {
      notificationSound.currentTime = 0;
      notificationSound.play().catch(e => console.log("Audio play failed:", e));
    } catch (e) {
      console.log("Notification sound error:", e);
    }
  };

  const showDesktopNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

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

  useEffect(() => {
    if (isAuthenticated && socketRef.current) {
      socketRef.current.emit("join_room", username);
    }
  }, [isAuthenticated, username]);

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
    const interval = setInterval(fetchUnreadCounts, 30000);
    
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleReceiveMessage = (newMessage) => {
      setMessages(prev => [...prev, newMessage]);
      
      if (!selectedUser || selectedUser.username !== newMessage.sender) {
        playNotificationSound();
        showDesktopNotification(
          `New message from ${newMessage.sender}`,
          newMessage.content.length > 30 
            ? `${newMessage.content.substring(0, 30)}...` 
            : newMessage.content
        );
        
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

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
      
      setUnreadCounts(prev => ({
        ...prev,
        [selectedUser.username]: 0
      }));
    }
  }, [selectedUser, username]);

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

  const handleReactToMessage = (messageId, emoji) => {
    if (socketRef.current) {
      socketRef.current.emit("react_to_message", { messageId, emoji });
      setShowEmojiPicker(false);
    }
  };

  const handleDeleteMessage = (messageId) => {
    if (socketRef.current && window.confirm("Are you sure you want to delete this message?")) {
      socketRef.current.emit("delete_message", { messageId });
    }
  };

  const handleEditMessage = (messageId, newContent) => {
    if (socketRef.current) {
      socketRef.current.emit("edit_message", { messageId, newContent });
      setEditingMessage(null);
    }
  };

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
        <motion.div 
          key={msg._id || i} 
          className="max-w-xs p-3 rounded-2xl mb-3 mx-auto bg-gray-700/20 backdrop-blur-sm italic text-gray-400"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, type: 'spring' }}
        >
          Message deleted
        </motion.div>
      );
    }
    
    const isMe = msg.sender === username;
    const showDate = i === 0 || 
      !isSameDay(new Date(msg.timestamp), new Date(messages[i-1]?.timestamp || 0));

    return (
      <React.Fragment key={msg._id || i}>
        {showDate && (
          <motion.div 
            className="text-center my-4 text-xs text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {formatDate(msg.timestamp)}
          </motion.div>
        )}
        <motion.div 
          className={`max-w-xs p-4 rounded-3xl mb-3 relative group ${
            isMe 
              ? "ml-auto bg-gradient-to-r from-indigo-500 to-purple-600 text-white" 
              : "mr-auto bg-gray-700/50 backdrop-blur-sm"
          }`}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, type: 'spring' }}
          whileHover={{ scale: 1.02 }}
        >
          {!isMe && (
            <p className="font-semibold text-sm mb-1">{msg.sender}</p>
          )}
          <p>{msg.content}</p>
          
          <div className="flex items-center justify-end gap-1 mt-2">
            {msg.edited && (
              <span className="text-xs opacity-70 mr-1">(edited)</span>
            )}
            <span className={`text-xs ${isMe ? 'opacity-80' : 'opacity-60'}`}>
              {formatTime(msg.timestamp)}
            </span>
            {isMe && (
              msg.read ? (
                <FaCheckDouble className="text-xs text-blue-200" />
              ) : (
                <FaCheck className="text-xs text-gray-300" />
              )
            )}
          </div>
          
          <motion.div 
            className={`absolute ${isMe ? '-left-10' : '-right-10'} top-0 opacity-0 group-hover:opacity-100 transition flex gap-1`}
            whileHover={{ scale: 1.1 }}
          >
            {isMe && (
              <>
                <button 
                  onClick={() => setEditingMessage(msg)}
                  className="p-1.5 rounded-full bg-gray-800/70 backdrop-blur-sm hover:bg-gray-700 transition"
                >
                  <FaEdit className="text-xs" />
                </button>
                <button 
                  onClick={() => handleDeleteMessage(msg._id)}
                  className="p-1.5 rounded-full bg-gray-800/70 backdrop-blur-sm hover:bg-gray-700 transition"
                >
                  <FaTrash className="text-xs" />
                </button>
              </>
            )}
            <button 
              onClick={() => setShowEmojiPicker(msg._id)}
              className="p-1.5 rounded-full bg-gray-800/70 backdrop-blur-sm hover:bg-gray-700 transition"
            >
              <FaSmile className="text-xs" />
            </button>
          </motion.div>
          
          {msg.reactions && msg.reactions.size > 0 && (
            <motion.div 
              className="flex gap-1 mt-2 flex-wrap"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {Array.from(msg.reactions.entries()).map(([user, emoji]) => (
                <motion.span 
                  key={`${msg._id}-${user}`} 
                  className="text-xs bg-gray-800/50 rounded-full px-2 py-0.5 backdrop-blur-sm"
                  title={user}
                  whileHover={{ scale: 1.1 }}
                >
                  {emoji}
                </motion.span>
              ))}
            </motion.div>
          )}
          
          {showEmojiPicker === msg._id && (
            <motion.div 
              className="absolute z-20"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <EmojiPicker 
                onEmojiClick={(emojiData) => handleReactToMessage(msg._id, emojiData.emoji)}
                width={300}
                height={350}
                skinTonesDisabled
                previewConfig={{ showPreview: false }}
                theme={darkMode ? 'dark' : 'light'}
              />
              <button 
                onClick={() => setShowEmojiPicker(false)}
                className="absolute top-0 right-0 p-1.5 bg-gray-700 rounded-full hover:bg-gray-600 transition"
              >
                <FaTimes className="text-xs" />
              </button>
            </motion.div>
          )}
        </motion.div>
      </React.Fragment>
    );
  };

  return (
    <div className={`fixed inset-0 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} flex flex-col`}>
      {!isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div 
            className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div 
              className="flex justify-center mb-6"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl ${darkMode ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : 'bg-gradient-to-r from-indigo-400 to-purple-500'} shadow-lg`}>
                {isLogin ? "👋" : "🚀"}
              </div>
            </motion.div>
            
            <h2 className={`text-3xl font-bold mb-6 text-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            
            {error && (
              <motion.div 
                className={`mb-4 p-3 rounded-lg text-center backdrop-blur-sm ${darkMode ? 'bg-red-500/80' : 'bg-red-400/90'}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Username</label>
                <input 
                  type="text" 
                  placeholder="Enter your username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full p-3 rounded-xl ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'} outline-none focus:ring-2 focus:ring-indigo-400 transition border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} 
                />
              </div>
              
              <div>
                <label className={`block text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Password</label>
                <input 
                  type="password" 
                  placeholder="Enter your password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full p-3 rounded-xl ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'} outline-none focus:ring-2 focus:ring-indigo-400 transition border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} 
                />
              </div>
              
              <button 
                onClick={handleAuth} 
                disabled={loading.auth}
                className={`w-full py-3 rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 font-medium ${darkMode ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : 'bg-gradient-to-r from-indigo-400 to-purple-500'} text-white shadow-md`}
              >
                {loading.auth ? (
                  <>
                    <ImSpinner8 className="animate-spin" />
                    {isLogin ? "Logging in..." : "Signing up..."}
                  </>
                ) : isLogin ? "Login" : "Signup"}
              </button>
              
              <p className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                <span 
                  className="text-indigo-400 cursor-pointer hover:underline"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Sign up" : "Log in"}
                </span>
              </p>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Mobile header */}
          <div className={`md:hidden flex items-center p-3 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {selectedUser ? (
              <>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="p-2 mr-2"
                >
                  <FaArrowLeft className={darkMode ? "text-white" : "text-gray-800"} />
                </button>
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} mr-2 flex items-center justify-center`}>
                    {selectedUser.profilePicture ? (
                      <img src={selectedUser.profilePicture} alt={selectedUser.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className={darkMode ? "text-white" : "text-gray-800"}>
                        {selectedUser.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className={darkMode ? "text-white" : "text-gray-800"}>{selectedUser.username}</span>
                </div>
              </>
            ) : (
              <span className={`font-bold ${darkMode ? "text-white" : "text-gray-800"}`}>Chats</span>
            )}
            
            {/* Always visible logout button on mobile */}
            <button 
              onClick={handleLogout}
              className={`ml-auto p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
            >
              <FaSignOutAlt className={darkMode ? "text-white" : "text-gray-800"} />
            </button>
            
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="ml-2 p-2"
            >
              {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-gray-800" />}
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Users list - always visible on desktop, conditional on mobile */}
            <div 
              className={`${selectedUser ? 'hidden md:block' : 'block'} w-full md:w-80 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-r ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
            >
              <div className="h-full flex flex-col">
                <div className={`p-3 flex justify-between items-center ${darkMode ? 'bg-gray-800' : 'bg-white'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h3 className={`font-bold ${darkMode ? "text-white" : "text-gray-800"}`}>Chats</h3>
                  
                  {/* Desktop logout button */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setDarkMode(!darkMode)}
                      className="p-1"
                    >
                      {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-gray-800" />}
                    </button>
                    <button 
                      onClick={handleLogout}
                      className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                    >
                      <FaSignOutAlt className={darkMode ? "text-white" : "text-gray-800"} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {loading.users ? (
                    <div className="flex justify-center py-8">
                      <ImSpinner8 className="animate-spin text-2xl text-indigo-400" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center h-full p-4 text-center ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      <FaRegComment className="text-3xl mb-2 opacity-50" />
                      <p>No other users found</p>
                      <p className="text-sm mt-1">Start chatting when someone joins!</p>
                    </div>
                  ) : (
                    users.map((user) => (
                      <motion.div 
                        key={user.username} 
                        onClick={() => {
                          setSelectedUser(user);
                        }}
                        className={`p-3 border-b ${darkMode ? 'border-gray-700 text-white' : 'border-gray-200 text-gray-800'} cursor-pointer ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'} transition flex justify-between items-center`}
                        whileHover={{ x: 2 }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              {user.profilePicture ? (
                                <img 
                                  src={user.profilePicture} 
                                  alt={user.username}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <span className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            {user.isOnline && (
                              <motion.div 
                                className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring' }}
                              />
                            )}
                          </div>
                          <div>
                            <p className={`font-semibold ${darkMode ? "text-white" : "text-gray-800"}`}>{user.username}</p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {getLastSeenStatus(user)}
                            </p>
                          </div>
                        </div>
                        {unreadCounts[user.username] > 0 && (
                          <motion.span 
                            className={`ml-auto rounded-full h-5 w-5 flex items-center justify-center ${darkMode ? 'bg-indigo-600' : 'bg-indigo-500'} text-white text-xs`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            {unreadCounts[user.username]}
                          </motion.span>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Chat area */}
            {selectedUser ? (
              <div className={`flex-1 flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className={`p-3 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center">
                    <div className="flex-1">
                      <h3 className={`font-bold ${darkMode ? "text-white" : "text-gray-800"}`}>{selectedUser.username}</h3>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {getLastSeenStatus(selectedUser)}
                        {typingUsers[selectedUser.username] && ' • typing...'}
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearchMessages()}
                        className={`px-3 py-1.5 rounded-lg text-sm w-40 focus:outline-none ${darkMode ? 'bg-gray-700 text-white focus:ring-indigo-400' : 'bg-gray-100 text-gray-900 focus:ring-indigo-300'}`}
                      />
                      <FaSearch 
                        className={`absolute right-2 top-2.5 cursor-pointer ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`} 
                        onClick={handleSearchMessages}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {loading.messages ? (
                    <div className="flex justify-center items-center h-full">
                      <ImSpinner8 className="animate-spin text-2xl text-indigo-400" />
                    </div>
                  ) : showSearchResults ? (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className={`font-bold text-lg ${darkMode ? "text-white" : "text-gray-800"}`}>Search Results</h4>
                        <button 
                          onClick={() => setShowSearchResults(false)}
                          className="text-sm text-indigo-400 hover:underline"
                        >
                          Back to chat
                        </button>
                      </div>
                      {searchResults.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center h-64 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <FaSearch className="text-2xl mb-2 opacity-50" />
                          <p>No results found</p>
                        </div>
                      ) : (
                        searchResults.map(renderMessage)
                      )}
                    </>
                  ) : messages.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center h-full ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <FaRegComment className="text-3xl mb-4 opacity-30" />
                      <p>No messages yet</p>
                      <p className="text-sm mt-2">Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map(renderMessage)
                  )}
                  
                  {typingUsers[selectedUser.username] && (
                    <motion.div 
                      className={`max-w-xs p-2 rounded-xl mb-3 mr-auto ${darkMode ? 'bg-gray-700/50' : 'bg-gray-200/80'} backdrop-blur-sm`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex gap-1">
                        <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-gray-400' : 'bg-gray-500'} animate-bounce`}></div>
                        <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-gray-400' : 'bg-gray-500'} animate-bounce`} style={{ animationDelay: "0.2s" }}></div>
                        <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-gray-400' : 'bg-gray-500'} animate-bounce`} style={{ animationDelay: "0.4s" }}></div>
                      </div>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                <div className={`p-3 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker("new");
                        inputRef.current.focus();
                      }}
                      className={`p-2 rounded-full transition ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                    >
                      <FaSmile className="text-xl" />
                    </button>
                    
                    <input 
                      ref={inputRef}
                      type="text" 
                      value={message} 
                      onChange={(e) => {
                        setMessage(e.target.value);
                        handleTyping(e.target.value.length > 0);
                      }}
                      placeholder="Type a message..." 
                      className={`flex-1 p-3 rounded-xl ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'} focus:outline-none focus:ring-1 ${darkMode ? 'focus:ring-indigo-400' : 'focus:ring-indigo-300'} transition`} 
                      maxLength="1000"
                    />
                    
                    <button 
                      type="submit" 
                      disabled={!message.trim()}
                      className={`p-3 rounded-xl transition ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-500 hover:bg-indigo-600'} text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <FaPaperPlane className="text-xl" />
                    </button>
                  </form>
                </div>
                
                <AnimatePresence>
                  {showEmojiPicker === "new" && (
                    <motion.div 
                      className="absolute bottom-16 left-4 right-4 md:left-auto md:right-16"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                    >
                      <EmojiPicker 
                        onEmojiClick={(emojiData) => {
                          setMessage(prev => prev + emojiData.emoji);
                          setShowEmojiPicker(false);
                          inputRef.current.focus();
                        }}
                        width="100%"
                        height={350}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                        theme={darkMode ? 'dark' : 'light'}
                      />
                      <button 
                        onClick={() => setShowEmojiPicker(false)}
                        className={`absolute top-0 right-0 p-1.5 rounded-full transition ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                      >
                        <FaTimes className="text-xs" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center">
                <div className={`p-8 rounded-lg ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} text-center`}>
                  <FaRegComment className="text-4xl mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Select a chat</h3>
                  <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                    Choose a conversation from the sidebar to start messaging
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <AnimatePresence>
        {editingMessage && (
          <motion.div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className={`p-6 rounded-xl max-w-md w-full shadow-xl ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <h3 className={`text-lg font-bold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>Edit Message</h3>
              <textarea
                value={editingMessage.content}
                onChange={(e) => setEditingMessage({
                  ...editingMessage,
                  content: e.target.value
                })}
                className={`w-full p-3 rounded-lg mb-4 focus:outline-none focus:ring-1 ${darkMode ? 'bg-gray-700 text-white focus:ring-indigo-400' : 'bg-gray-100 text-gray-900 focus:ring-indigo-300'}`}
                rows="3"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingMessage(null)}
                  className={`px-4 py-2 rounded-lg transition ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleEditMessage(editingMessage._id, editingMessage.content)}
                  className={`px-4 py-2 rounded-lg transition ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-500 hover:bg-indigo-600'} text-white`}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;