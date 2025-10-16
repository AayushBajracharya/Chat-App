require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(cors());
app.use(express.json());

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join", async ({ username, room }) => {
    socket.username = username;
    socket.room = room;

    socket.join(room);

    try {
      const messages = await Message.find({ room })
        .sort({ timestamp: 1 })
        .limit(50);
      socket.emit("loadMessages", messages);
      io.to(room).emit("message", {
        user: "System",
        text: `${username} has joined the ${room} room`,
      });
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  });

  socket.on("sendMessage", async ({ message, room }) => {
    if (!socket.username || !room) return;

    const newMessage = new Message({
      user: socket.username,
      text: message,
      room,
    });
    try {
      await newMessage.save();
      io.to(room).emit("message", {
        user: socket.username,
        text: message,
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("disconnect", () => {
    if (socket.username && socket.room) {
      io.to(socket.room).emit("message", {
        user: "System",
        text: `${socket.username} has left the ${socket.room} room`,
      });
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
