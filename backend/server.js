require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const Message = require("./models/Message");

app.use(cors());
app.use(express.json());

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join", async (username) => {
    socket.username = username;

    // Load and send previous messages from DB
    try {
      const messages = await Message.find().sort({ timestamp: 1 }).limit(50);
      socket.emit("loadMessages", messages); // Send to the joining user only
      io.emit("message", {
        user: "System",
        text: `${username} has joined the chat`,
      });
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  });

  socket.on("sendMessage", async (message) => {
    if (!socket.username) return; // Prevent anonymous messages

    const newMessage = new Message({ user: socket.username, text: message });
    try {
      await newMessage.save(); // Save to DB
      io.emit("message", { user: socket.username, text: message }); // Broadcast
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("message", {
        user: "System",
        text: `${socket.username} has left the chat`,
      });
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
