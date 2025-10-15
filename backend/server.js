const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5174",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Join a room (for simplicity, one global room)
  socket.on("join", (username) => {
    socket.username = username;
    io.emit("message", {
      user: "System",
      text: `${username} has joined the chat`,
    });
  });

  // Handle incoming messages
  socket.on("sendMessage", (message) => {
    io.emit("message", { user: socket.username, text: message });
  });

  // Handle disconnection
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
