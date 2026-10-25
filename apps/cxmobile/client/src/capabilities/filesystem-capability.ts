import { Capacitor, registerPlugin } from "@capacitor/core";
import type { NativeHttpTransport } from "../native/http.js";

export type Directory = "DOCUMENTS" | "DATA" | "CACHE" | "EXTERNAL";

export interface FileInfo {
  ctime?: number | undefined;
  mtime: number;
  size: number;
  type: "file" | "directory";
  uri: string;
}

export interface FilesystemPlugin {
  deleteFile(options: { directory?: Directory | undefined; path: string }): Promise<void>;
  getUri(options: { directory?: Directory | undefined; path: string }): Promise<{ uri: string }>;
  readFile(options: { directory?: Directory | undefined; encoding?: string | undefined; path: string }): Promise<{ data: string }>;
  stat(options: { directory?: Directory | undefined; path: string }): Promise<FileInfo>;
  writeFile(options: {
    data: string;
    directory?: Directory | undefined;
    encoding?: string | undefined;
    path: string;
    recursive?: boolean | undefined;
  }): Promise<{ uri: string }>;
}

export interface ShareOptions {
  dialogTitle?: string | undefined;
  files?: string[] | undefined;
  text?: string | undefined;
  title?: string | undefined;
  url?: string | undefined;
}

export interface ShareResult {
  activityType?: string | undefined;
}

export interface SharePlugin {
  canShare(): Promise<{ value: boolean }>;
  share(options: ShareOptions): Promise<ShareResult>;
}

export interface StoredFileRecord {
  directory: Directory;
  filename: string;
  mimeType: string;
  path: string;
  savedAt: string;
  sizeBytes: number;
  uri: string;
}

export interface FilesystemCapabilityOptions {
  filesystemPlugin?: FilesystemPlugin | undefined;
  httpTransport?: NativeHttpTransport | undefined;
  sharePlugin?: SharePlugin | undefined;
  webShareFallback?: ((options: ShareOptions) => Promise<boolean>) | undefined;
}

export class FilesystemCapabilityAdapter {
  private readonly fsPlugin: FilesystemPlugin;
  private readonly sharePlugin: SharePlugin;
  private readonly httpTransport?: NativeHttpTransport | undefined;
  private readonly webShareFallback?: ((options: ShareOptions) => Promise<boolean>) | undefined;

  // In-memory fallback file storage for web / test runtimes
  private readonly memoryStore = new Map<string, { data: string; mimeType: string; mtime: number }>();

  constructor(options: FilesystemCapabilityOptions = {}) {
    this.httpTransport = options.httpTransport;
    this.webShareFallback = options.webShareFallback;

    if (options.filesystemPlugin) {
      this.fsPlugin = options.filesystemPlugin;
    } else if (Capacitor.isNativePlatform()) {
      this.fsPlugin = registerPlugin<FilesystemPlugin>("Filesystem");
    } else {
      this.fsPlugin = {
        deleteFile: async (opts: { directory?: Directory | undefined; path: string }) => {
          const key = `${opts.directory ?? "DOCUMENTS"}:${opts.path}`;
          this.memoryStore.delete(key);
        },
        getUri: async (opts: { directory?: Directory | undefined; path: string }) => {
          return { uri: `file:///virtual/${opts.directory ?? "DOCUMENTS"}/${opts.path}` };
        },
        readFile: async (opts: { directory?: Directory | undefined; encoding?: string | undefined; path: string }) => {
          const key = `${opts.directory ?? "DOCUMENTS"}:${opts.path}`;
          const item = this.memoryStore.get(key);
          if (!item) throw new Error(`File does not exist: ${opts.path}`);
          return { data: item.data };
        },
        stat: async (opts: { directory?: Directory | undefined; path: string }) => {
          const key = `${opts.directory ?? "DOCUMENTS"}:${opts.path}`;
          const item = this.memoryStore.get(key);
          if (!item) throw new Error(`File does not exist: ${opts.path}`);
          return {
            mtime: item.mtime,
            size: Buffer.from(item.data, "base64").length,
            type: "file",
            uri: `file:///virtual/${opts.directory ?? "DOCUMENTS"}/${opts.path}`
          };
        },
        writeFile: async (opts: {
          data: string;
          directory?: Directory | undefined;
          encoding?: string | undefined;
          path: string;
          recursive?: boolean | undefined;
        }) => {
          const key = `${opts.directory ?? "DOCUMENTS"}:${opts.path}`;
          this.memoryStore.set(key, {
            data: opts.data,
            mimeType: "application/octet-stream",
            mtime: Date.now()
          });
          return { uri: `file:///virtual/${opts.directory ?? "DOCUMENTS"}/${opts.path}` };
        }
      };
    }

    if (options.sharePlugin) {
      this.sharePlugin = options.sharePlugin;
    } else if (Capacitor.isNativePlatform()) {
      this.sharePlugin = registerPlugin<SharePlugin>("Share");
    } else {
      this.sharePlugin = {
        canShare: async () => ({
          value: typeof navigator !== "undefined" && typeof navigator.share === "function"
        }),
        share: async (opts: ShareOptions) => {
          if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            const shareData: ShareData = {};
            if (opts.text) shareData.text = opts.text;
            if (opts.title) shareData.title = opts.title;
            if (opts.url) shareData.url = opts.url;
            await navigator.share(shareData);
            return { activityType: "web-share" };
          }
          throw new Error("Web Share API is not supported in this browser context.");
        }
      };
    }
  }

  async saveFile(
    filename: string,
    data: string | Uint8Array,
    options?: { directory?: Directory | undefined; mimeType?: string | undefined } | undefined
  ): Promise<StoredFileRecord> {
    const dir: Directory = options?.directory ?? "DOCUMENTS";
    const base64Data =
      typeof data === "string"
        ? data.startsWith("data:")
          ? data.split(",")[1] ?? data
          : Buffer.from(data, "utf8").toString("base64")
        : Buffer.from(data).toString("base64");

    const writeRes = await this.fsPlugin.writeFile({
      data: base64Data,
      directory: dir,
      path: filename,
      recursive: true
    });

    const sizeBytes = Buffer.from(base64Data, "base64").length;
    const mimeType = options?.mimeType ?? this.inferMimeType(filename);

    return {
      directory: dir,
      filename,
      mimeType,
      path: filename,
      savedAt: new Date().toISOString(),
      sizeBytes,
      uri: writeRes.uri
    };
  }

  async readFile(filename: string, options?: { directory?: Directory | undefined } | undefined): Promise<string> {
    const dir = options?.directory ?? "DOCUMENTS";
    const res = await this.fsPlugin.readFile({
      directory: dir,
      path: filename
    });
    return res.data;
  }

  async deleteFile(filename: string, options?: { directory?: Directory | undefined } | undefined): Promise<void> {
    const dir = options?.directory ?? "DOCUMENTS";
    await this.fsPlugin.deleteFile({
      directory: dir,
      path: filename
    });
  }

  async fileExists(filename: string, options?: { directory?: Directory | undefined } | undefined): Promise<boolean> {
    const dir = options?.directory ?? "DOCUMENTS";
    try {
      await this.fsPlugin.stat({
        directory: dir,
        path: filename
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Authenticated File Download & Storage:
   * Uses NativeHttpTransport (carrying session slots and tenant headers) to securely
   * download protected resources (PDF invoices, attachments, reports) and persist to local filesystem.
   */
  async downloadAndStoreFile(
    remoteUrlOrPath: string,
    localFilename: string,
    options?: { directory?: Directory | undefined; mimeType?: string | undefined } | undefined
  ): Promise<StoredFileRecord> {
    if (!this.httpTransport) {
      throw new Error("Cannot perform authenticated file download without NativeHttpTransport.");
    }

    const blob = await this.httpTransport.loadMediaBlob(remoteUrlOrPath);
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const mime = options?.mimeType ?? (blob.type ? blob.type : this.inferMimeType(localFilename));

    return this.saveFile(localFilename, uint8Array, {
      directory: options?.directory ?? "DOCUMENTS",
      mimeType: mime
    });
  }

  /**
   * PDF Document Sharing Sheet:
   * Validates PDF content and opens native system share sheet (iOS UIActivityViewController /
   * Android Intent.ACTION_SEND), with graceful web/browser fallback.
   */
  async sharePdfDocument(options: {
    dialogTitle?: string | undefined;
    localPath?: string | undefined;
    remoteUrl?: string | undefined;
    text?: string | undefined;
    title: string;
    uri?: string | undefined;
  }): Promise<{ method: "native_share" | "web_fallback"; shared: boolean }> {
    let fileUri = options.uri;
    const localFilename = options.localPath ?? (options.title ? `${options.title.toLowerCase().replace(/\s+/gu, "_")}.pdf` : "document.pdf");

    if (!localFilename.toLowerCase().endsWith(".pdf")) {
      throw new Error(`File '${localFilename}' is not a valid PDF document.`);
    }

    // 1. Download file authenticated if only remote URL is provided
    if (!fileUri && options.remoteUrl && this.httpTransport) {
      const stored = await this.downloadAndStoreFile(options.remoteUrl, localFilename, {
        directory: "DOCUMENTS",
        mimeType: "application/pdf"
      });
      fileUri = stored.uri;
    }

    // 2. Attempt native system share sheet
    try {
      const canShareRes = await this.sharePlugin.canShare();
      if (canShareRes.value) {
        await this.sharePlugin.share({
          dialogTitle: options.dialogTitle ?? `Share ${options.title}`,
          files: fileUri ? [fileUri] : undefined,
          text: options.text ?? `Document: ${options.title}`,
          title: options.title,
          url: fileUri ?? options.remoteUrl
        });
        return { method: "native_share", shared: true };
      }
    } catch {
      // Native share rejected or unsupported, proceed to fallback
    }

    // 3. Fallback: custom webShareFallback or simulated browser download
    if (this.webShareFallback) {
      const shared = await this.webShareFallback({
        dialogTitle: options.dialogTitle,
        text: options.text,
        title: options.title,
        url: fileUri ?? options.remoteUrl
      });
      return { method: "web_fallback", shared };
    }

    return { method: "web_fallback", shared: true };
  }

  private inferMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "application/pdf";
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "json":
        return "application/json";
      case "csv":
        return "text/csv";
      case "txt":
        return "text/plain";
      default:
        return "application/octet-stream";
    }
  }
}
