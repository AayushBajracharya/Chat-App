import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import Login from "./Login";
import Signup from "./Signup";

function Chat() {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [joined, setJoined] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const socketRef = useRef(null);
  const chatRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_BACKEND_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
      setToken(null);
      setUsername("");
      setJoined(false);
      localStorage.removeItem("token");
      localStorage.removeItem("username");
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.on("chatMessage", (msg) => {
      console.log("Received chatMessage:", msg);
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            user: msg.user,
            text: msg.text,
            id: msg.id || Date.now().toString(),
          },
        ];
        console.log("Updated messages:", newMessages);
        return newMessages;
      });
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    });

    socket.on("loadMessages", (loadedMessages) => {
      console.log("Loaded messages:", loadedMessages);
      setMessages((prev) => {
        const newMessages = loadedMessages.map((msg) => ({
          user: msg.user,
          text: msg.text,
          id: msg._id ? msg._id.toString() : Date.now().toString(),
        }));
        const allMessages = [
          ...newMessages,
          ...prev.filter((p) => !newMessages.some((n) => n.id === p.id)),
        ].sort((a, b) => a.id.localeCompare(b.id));
        console.log("Merged messages:", allMessages);
        return allMessages;
      });
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    });

    socket.on("typing", ({ user, isTyping }) => {
      console.log(`${user} ${isTyping ? "started" : "stopped"} typing`);
      setTypingUsers((prev) => {
        if (isTyping && user !== username && !prev.includes(user)) {
          return [...prev, user];
        } else if (!isTyping && user !== username) {
          return prev.filter((u) => u !== user);
        }
        return prev;
      });
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.off("chatMessage");
      socket.off("loadMessages");
      socket.off("typing");
      socket.disconnect();
    };
  }, [token, username]);

  const handleTyping = () => {
    if (room && socketRef.current) {
      const normalizedRoom = room.trim().toLowerCase();
      socketRef.current.emit("typing", {
        room: normalizedRoom,
        isTyping: true,
      });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit("typing", {
          room: normalizedRoom,
          isTyping: false,
        });
      }, 3000);
    }
  };

  const handleAuth = (newToken, newUsername, toggleForm = false) => {
    setToken(newToken);
    setUsername(newUsername);
    if (newToken && newUsername) {
      localStorage.setItem("token", newToken);
      localStorage.setItem("username", newUsername);
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
    }
    if (toggleForm) {
      setShowSignup(!showSignup);
    }
  };

  const joinChat = () => {
    if (room && socketRef.current) {
      const normalizedRoom = room.trim().toLowerCase();
      socketRef.current.emit("join", { room: normalizedRoom });
      setRoom(normalizedRoom);
      setJoined(true);
      console.log("Joining room:", normalizedRoom);
    }
  };

  const sendMessage = () => {
    if (message && room && socketRef.current) {
      const normalizedRoom = room.trim().toLowerCase();
      socketRef.current.emit("sendMessage", { message, room: normalizedRoom });
      setMessage("");
      console.log("Sent message:", message, "to room:", normalizedRoom);
      socketRef.current.emit("typing", {
        room: normalizedRoom,
        isTyping: false,
      });
      setTypingUsers((prev) => prev.filter((u) => u !== username));
    }
  };

  if (!token || !username) {
    return showSignup ? (
      <Signup onSignup={handleAuth} />
    ) : (
      <Login onLogin={handleAuth} />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      {!joined ? (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-center">Join Chat</h2>
          <p className="mb-4">Logged in as: {username}</p>
          <input
            type="text"
            placeholder="Enter room name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="w-full p-2 mb-4 border border-gray-300 rounded"
          />
          <button
            onClick={joinChat}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Join
          </button>
          <button
            onClick={() => handleAuth(null, null)}
            className="w-full mt-4 bg-red-500 text-white p-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md flex flex-col h-96">
          <h2 className="text-2xl font-bold mb-4 text-center">
            Chat Room: {room}
          </h2>
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto mb-4 border border-gray-300 p-2 rounded"
          >
            {messages.length === 0 ? (
              <div className="text-gray-500 text-center">No messages yet</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="mb-2">
                  <strong>{msg.user}:</strong> {msg.text}
                </div>
              ))
            )}
            {typingUsers.length > 0 && (
              <div className="text-gray-500 italic text-sm">
                {typingUsers.join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}
          </div>
          <div className="flex">
            <input
              type="text"
              placeholder="Type a message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleTyping}
              className="flex-1 p-2 border border-gray-300 rounded-l"
            />
            <button
              onClick={sendMessage}
              className="bg-blue-500 text-white p-2 rounded-r hover:bg-blue-600"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
