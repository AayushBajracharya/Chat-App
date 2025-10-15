import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

function Chat() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("loadMessages", (loadedMessages) => {
      setMessages(
        loadedMessages.map((msg) => ({ user: msg.user, text: msg.text }))
      );
    });

    return () => {
      socket.off("message");
      socket.off("loadMessages");
    };
  }, []);

  const joinChat = () => {
    if (username) {
      socket.emit("join", username);
      setJoined(true);
    }
  };

  const sendMessage = () => {
    if (message) {
      socket.emit("sendMessage", message);
      setMessage("");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      {!joined ? (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-center">Join Chat</h2>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 mb-4 border border-gray-300 rounded"
          />
          <button
            onClick={joinChat}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Join
          </button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md flex flex-col h-96">
          <h2 className="text-2xl font-bold mb-4 text-center">Chat Room</h2>
          <div className="flex-1 overflow-y-auto mb-4 border border-gray-300 p-2 rounded">
            {messages.map((msg, index) => (
              <div key={index} className="mb-2">
                <strong>{msg.user}:</strong> {msg.text}
              </div>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              placeholder="Type a message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
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
