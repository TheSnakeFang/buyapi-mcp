import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeStoredApiKey } from "./config.js";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export async function runBrowserLogin(): Promise<string> {
  const state = randomBytes(16).toString("hex");
  const server = createServer();

  const keyPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for browser login."));
    }, LOGIN_TIMEOUT_MS);

    server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      if (url.searchParams.get("state") !== state) {
        response.writeHead(400);
        response.end("Invalid login state.");
        return;
      }
      const key = url.searchParams.get("key");
      if (!key?.startsWith("ba_")) {
        response.writeHead(400);
        response.end("Missing BuyAPI API key.");
        return;
      }

      writeStoredApiKey(key);
      response.writeHead(200, {
        "Content-Type": "text/html",
        Connection: "close",
      });
      response.end(
        "<!doctype html><title>BuyAPI CLI connected</title><body><h1>BuyAPI CLI connected.</h1><p>You can close this tab and return to your terminal.</p></body>"
      );
      clearTimeout(timeout);
      setImmediate(() => {
        server.closeAllConnections?.();
        server.close();
      });
      resolve(key);
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not start local login callback server.");
  }

  const url = new URL("https://buyapi.ai/cli-login");
  url.searchParams.set("port", String(address.port));
  url.searchParams.set("state", state);
  url.searchParams.set("name", "BuyAPI CLI");
  console.log(`Opening browser login: ${url.toString()}`);
  openBrowser(url.toString());
  return keyPromise;
}

function openBrowser(url: string) {
  const platform = process.platform;
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args: string[] = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}
