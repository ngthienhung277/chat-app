const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");

const { addUser, removeUser, getUser, getUsersInRoom } = require("./users");

const router = require("./router");

const PORT = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(router);

io.on("connect", (socket) => {
  console.log("Connected to server");
  socket.on("join", ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) return callback(error);
    if(!user) {
      return callback("User not found");
    }
    socket.join(user.room);

    if (error) {
      console.error(error);
    } else {
      console.log("Joined successfully");
    }
    console.log(`Sending welcome message to ${user.name} in room ${user.room}`);
    socket.emit("message", {
      user: "admin",
      text: `${user.name}, welcome to the room ${user.room}`,
    });

    socket.broadcast
      .to(user.room)
      .emit("message", { user: "admin", text: `${user.name}, has joined!` });

    io.to(user?.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    console.log(`Attempting to send message. Socket ID: ${socket.id}`);
    const user = getUser(socket.id);

    if(!user) {
      console.error(`No user found for socket ID: ${socket.id}`);
      return callback("User not found");
    }

    console.log(`Sending message from ${user.name} in room ${user.room}`);
    io.to(user.room).emit("message", { user: user.name, text: message });

    callback();
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected. Socket ID: ${socket.id}`);
    const user = removeUser(socket.id);

    if (user) {
      io.to(user?.room).emit("message", {
        user: "admin",
        text: `${user.name} has left the room`,
      });
      io.to(user?.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(PORT, () => console.log(`Server has started on port ${PORT}`));
