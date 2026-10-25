import { writeFile } from "node:fs/promises";

export class BrowserPage {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new BrowserPage(socket);
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Browser command timed out: " + method));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error("Browser page evaluation failed.");
    return response.result.value;
  }

  async waitFor(expression, label) {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await this.evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Browser did not show " + label + ". Inspect the local page manually.");
  }

  async screenshot(path) {
    const result = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(path, Buffer.from(result.data, "base64"));
  }
}
