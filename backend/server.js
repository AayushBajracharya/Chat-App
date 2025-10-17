require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Signup Route
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const user = new User({ username, password });
    await user.save();
    const token = jwt.sign(
      { userId: user._id, username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.status(201).json({ token, username });
  } catch (err) {
    res.status(500).json({ error: "Error signing up" });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
      { userId: user._id, username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: "Error logging in" });
  }
});

// Middleware to verify JWT for Socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// Track users in rooms
const roomUsers = new Map();

io.on("connection", (socket) => {
  console.log(
    "A user connected:",
    socket.id,
    "Username:",
    socket.user.username
  );

  socket.on("join", async ({ room }) => {
    const normalizedRoom = room.trim().toLowerCase();
    socket.room = normalizedRoom;
    socket.join(normalizedRoom);
    console.log(`${socket.user.username} joined room: ${normalizedRoom}`);

    if (!roomUsers.has(normalizedRoom)) {
      roomUsers.set(normalizedRoom, new Set());
    }
    roomUsers.get(normalizedRoom).add(socket.user.username);
    io.to(normalizedRoom).emit("userList", {
      users: Array.from(roomUsers.get(normalizedRoom)),
    });
    console.log(
      `User list in ${normalizedRoom}:`,
      Array.from(roomUsers.get(normalizedRoom))
    );

    try {
      const messages = await Message.find({ room: normalizedRoom })
        .sort({ timestamp: 1 })
        .limit(50);
      socket.emit(
        "loadMessages",
        messages.map((msg) => ({
          _id: msg._id.toString(),
          user: msg.user,
          text: msg.text,
          room: msg.room,
          timestamp: msg.timestamp, // Include timestamp
        }))
      );
      io.to(normalizedRoom).emit("chatMessage", {
        user: "System",
        text: `${socket.user.username} has joined the ${normalizedRoom} room`,
        id: Date.now().toString(),
        timestamp: new Date(), // Include timestamp
      });
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  });

  socket.on("sendMessage", async ({ message, room }) => {
    const normalizedRoom = room.trim().toLowerCase();
    if (!socket.user || !normalizedRoom) return;

    const newMessage = new Message({
      user: socket.user.username,
      text: message,
      room: normalizedRoom,
    });
    try {
      await newMessage.save();
      console.log(
        `Message saved: ${message} in room ${normalizedRoom} by ${socket.user.username}`
      );
      io.to(normalizedRoom).emit("chatMessage", {
        user: socket.user.username,
        text: message,
        id: newMessage._id.toString(),
        timestamp: newMessage.timestamp, // Include timestamp
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("typing", ({ room, isTyping }) => {
    const normalizedRoom = room.trim().toLowerCase();
    if (!socket.user || !normalizedRoom) return;
    console.log(
      `${socket.user.username} ${
        isTyping ? "started" : "stopped"
      } typing in room: ${normalizedRoom}`
    );
    socket.to(normalizedRoom).emit("typing", {
      user: socket.user.username,
      isTyping,
    });
  });

  socket.on("disconnect", () => {
    if (socket.user && socket.room) {
      roomUsers.get(socket.room)?.delete(socket.user.username);
      io.to(socket.room).emit("userList", {
        users: Array.from(roomUsers.get(socket.room) || []),
      });
      console.log(
        `User list in ${socket.room}:`,
        Array.from(roomUsers.get(socket.room) || [])
      );
      io.to(socket.room).emit("chatMessage", {
        user: "System",
        text: `${socket.user.username} has left the ${socket.room} room`,
        id: Date.now().toString(),
        timestamp: new Date(), // Include timestamp
      });
      console.log(
        `${socket.user.username} disconnected from room: ${socket.room}`
      );
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
