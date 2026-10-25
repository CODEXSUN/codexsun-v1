import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

export class FilesystemAdapter {
  async writeBinary(
    path: string,
    dataBase64: string,
    directory: Directory = Directory.Documents
  ): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.writeFile({
        data: dataBase64,
        directory,
        path,
        recursive: true
      });
      return res.uri;
    }

    // Web fallback: download prompt if running in browser
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const byteCharacters = atob(dataBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);
      const url = URL.createObjectURL(blob);
      return url;
    }

    return `in-memory://${path}`;
  }

  async writeText(
    path: string,
    text: string,
    directory: Directory = Directory.Documents
  ): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.writeFile({
        data: text,
        directory,
        encoding: Encoding.UTF8,
        path,
        recursive: true
      });
      return res.uri;
    }
    return `in-memory://${path}`;
  }

  async readFile(
    path: string,
    directory: Directory = Directory.Documents
  ): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.readFile({
        directory,
        encoding: Encoding.UTF8,
        path
      });
      return typeof res.data === "string" ? res.data : "";
    }
    return "";
  }

  async deleteFile(
    path: string,
    directory: Directory = Directory.Documents
  ): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.deleteFile({
          directory,
          path
        });
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }

  async getFileUri(
    path: string,
    directory: Directory = Directory.Documents
  ): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.getUri({
        directory,
        path
      });
      return res.uri;
    }
    return `in-memory://${path}`;
  }
}
