import * as NodeNet from "node:net";

import type { DiscordConnect } from "./DiscordPresenceController.ts";

/** Connects to a Discord IPC socket path or named pipe. Rejects when nothing listens there. */
export const connectDiscordSocket: DiscordConnect = (path, handlers) =>
  new Promise((resolve, reject) => {
    const socket = NodeNet.createConnection(path);
    let settled = false;
    socket.once("connect", () => {
      settled = true;
      socket.on("data", (chunk) => handlers.onData(chunk));
      socket.on("close", () => handlers.onClose());
      socket.on("error", (error) => handlers.onError(error));
      resolve({
        write: (data) => {
          socket.write(data);
        },
        end: () => {
          socket.removeAllListeners("close");
          socket.removeAllListeners("error");
          socket.on("error", () => {});
          socket.destroy();
        },
      });
    });
    socket.once("error", (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    });
  });
