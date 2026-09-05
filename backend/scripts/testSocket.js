/**
 * Socket integration smoke tests.
 *
 * Usage:
 *   node scripts/testSocket.js
 *
 * Requires backend running on PORT (default 5000) and valid demo credentials.
 */

import { io } from "socket.io-client";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const API_URL = `${BASE_URL}/api/v1`;
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const registerTestUser = async () => {
  const suffix = Date.now();
  const email = `socket.test.${suffix}@gmail.com`;
  const username = `socket_test_${suffix}`;
  const password = "Password123";

  const response = await fetch(`${API_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      username,
      password,
      fullName: "Socket Test User",
    }),
  });

  assert(response.ok, `Register failed with status ${response.status}`);

  const json = await response.json();
  const accessToken = json?.data?.accessToken;
  assert(typeof accessToken === "string" && accessToken.length > 0, "Register response missing accessToken");
  return accessToken;
};

const login = async () => {
  if (TEST_EMAIL && TEST_PASSWORD) {
    const response = await fetch(`${API_URL}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    if (response.ok) {
      const json = await response.json();
      const accessToken = json?.data?.accessToken;
      assert(typeof accessToken === "string" && accessToken.length > 0, "Login response missing accessToken");
      return accessToken;
    }
  }

  return registerTestUser();
};

const fetchSocketToken = async (accessToken) => {
  const response = await fetch(`${API_URL}/users/socket-token`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  assert(response.ok, `socket-token failed with status ${response.status}`);

  const json = await response.json();
  const token = json?.data?.accessToken;
  assert(typeof token === "string" && token.length > 0, "socket-token response missing accessToken");
  return token;
};

const connectSocket = (token) =>
  new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      auth: { token },
      transports: ["websocket"],
      timeout: 5000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection timed out"));
    }, 7000);

    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

const testPresence = (socket) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Did not receive getOnlineUsers event"));
    }, 5000);

    socket.once("getOnlineUsers", (users) => {
      clearTimeout(timer);
      assert(Array.isArray(users), "getOnlineUsers payload should be an array");
      resolve(users);
    });
  });

const testRejectInvalidToken = async () => {
  await new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      auth: { token: "invalid-token" },
      transports: ["websocket"],
      timeout: 5000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Invalid token connection should fail"));
    }, 7000);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.disconnect();
      reject(new Error("Invalid token unexpectedly connected"));
    });

    socket.on("connect_error", () => {
      clearTimeout(timer);
      resolve();
    });
  });
};

const run = async () => {
  console.log("▶ Running socket smoke tests");

  await testRejectInvalidToken();
  console.log("✓ Rejects invalid socket token");

  const accessToken = await login();
  console.log("✓ Login returns accessToken");

  const socketToken = await fetchSocketToken(accessToken);
  assert(socketToken === accessToken, "socket-token should return current access token");
  console.log("✓ GET /users/socket-token works");

  const socket = await connectSocket(accessToken);
  console.log(`✓ Socket connected (${socket.id})`);

  await testPresence(socket);
  console.log("✓ Presence event received");

  socket.disconnect();
  console.log("✓ Socket smoke tests passed");
};

run().catch((error) => {
  console.error("✗ Socket smoke tests failed:", error.message);
  process.exit(1);
});
