/**
 * Unit tests for socket presence helpers.
 *
 * Usage:
 *   node scripts/testPresenceRegistry.js
 */

import { createServer } from "http";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";
import jwt from "jsonwebtoken";
import {
  addUserSocket,
  removeUserSocket,
  emitToUser,
  getOnlineUserIds,
} from "../src/socket/presence.registry.js";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const testRegistryLifecycle = () => {
  addUserSocket("user-1", "socket-a");
  addUserSocket("user-1", "socket-b");

  assert(getOnlineUserIds().includes("user-1"), "user-1 should be online");

  const removedUser = removeUserSocket("socket-a");
  assert(removedUser === "user-1", "removeUserSocket should return user id");
  assert(getOnlineUserIds().includes("user-1"), "user-1 should remain online with one socket");

  removeUserSocket("socket-b");
  assert(!getOnlineUserIds().includes("user-1"), "user-1 should be offline after last socket removed");
};

const testRoomEmit = async () => {
  const secret = process.env.ACCESS_TOKEN_SECRET || "test-secret";
  const token = jwt.sign({ _id: "user-123" }, secret, { expiresIn: "1h" });

  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;
      const decoded = jwt.verify(authToken, secret);
      socket.userId = decoded._id.toString();
      socket.join(`user:${socket.userId}`);
      addUserSocket(socket.userId, socket.id);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();

  const client = createClient(`http://localhost:${port}`, {
    auth: { token },
    transports: ["websocket"],
  });

  await new Promise((resolve, reject) => {
    client.on("connect", resolve);
    client.on("connect_error", reject);
  });

  const payloadPromise = new Promise((resolve) => {
    client.on("message:new", resolve);
  });

  emitToUser(io, "user-123", "message:new", {
    message: { _id: "m1", message: "hello" },
    conversationId: "c1",
  });

  const payload = await payloadPromise;
  assert(payload?.message?.message === "hello", "room emit should deliver message:new payload");

  client.disconnect();
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
};

const run = async () => {
  console.log("▶ Running presence registry tests");
  testRegistryLifecycle();
  console.log("✓ Registry lifecycle works");
  await testRoomEmit();
  console.log("✓ Room-based emitToUser works");
  console.log("✓ Presence registry tests passed");
};

run().catch((error) => {
  console.error("✗ Presence registry tests failed:", error.message);
  process.exit(1);
});
