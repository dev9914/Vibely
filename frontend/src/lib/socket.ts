import { io, Socket } from "socket.io-client";
import {
  ensureAccessToken,
  getAccessToken,
  refreshAccessToken,
} from "@/lib/authToken";
import { getSocketUrl } from "@/lib/apiConfig";
import { SOCKET_EVENTS } from "@/lib/constants";

let socket: Socket | null = null;

const requestPresenceSync = (activeSocket: Socket) => {
  if (activeSocket.connected) {
    activeSocket.emit(SOCKET_EVENTS.PRESENCE_REQUEST_SYNC);
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

export const updateSocketAuth = (token: string | null) => {
  if (!socket || !token) return;
  socket.auth = { token };
  if (socket.disconnected) {
    socket.connect();
  }
};

export const connectSocket = (token?: string | null): Socket => {
  const authToken = token ?? getAccessToken();
  if (!authToken) {
    throw new Error("Cannot connect socket without an access token");
  }

  if (socket && !socket.disconnected) {
    socket.auth = { token: authToken };
    requestPresenceSync(socket);
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io(getSocketUrl(), {
    auth: { token: authToken },
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("[socket] connected", socket?.id);
    requestPresenceSync(socket!);
  });

  socket.on("connect_error", (error) => {
    console.error("[socket] connection error", error.message);
  });

  socket.io.on("reconnect_attempt", async () => {
    let nextToken = getAccessToken();
    if (!nextToken) {
      nextToken = await ensureAccessToken();
    }
    if (!nextToken) {
      nextToken = await refreshAccessToken();
    }
    if (nextToken && socket) {
      socket.auth = { token: nextToken };
    }
  });

  return socket;
};

export const connectSocketWithAuth = async (): Promise<Socket | null> => {
  const token = await ensureAccessToken();
  if (!token) {
    console.warn("[socket] skipped connect: no access token available");
    return null;
  }

  return connectSocket(token);
};

export const startSocket = (activeSocket: Socket = socket!): void => {
  if (!activeSocket.connected) {
    activeSocket.connect();
  } else {
    requestPresenceSync(activeSocket);
  }
};
