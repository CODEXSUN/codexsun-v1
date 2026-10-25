import { Camera, CameraResultType, CameraSource, type Photo } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

export interface CapturedImage {
  base64String?: string | undefined;
  dataUrl?: string | undefined;
  format: string;
  webPath?: string | undefined;
}

export class CameraAdapter {
  async checkPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true;
    }
    try {
      const status = await Camera.checkPermissions();
      return status.camera === "granted" || status.photos === "granted";
    } catch {
      return true;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true;
    }
    try {
      const status = await Camera.requestPermissions({ permissions: ["camera", "photos"] });
      return status.camera === "granted" || status.photos === "granted";
    } catch {
      return false;
    }
  }

  async capturePhoto(options?: { quality?: number; allowEditing?: boolean }): Promise<CapturedImage> {
    if (Capacitor.isNativePlatform()) {
      const photo: Photo = await Camera.getPhoto({
        allowEditing: options?.allowEditing ?? false,
        correctOrientation: true,
        quality: options?.quality ?? 85,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      return {
        base64String: photo.base64String,
        dataUrl: photo.base64String ? `data:image/${photo.format};base64,${photo.base64String}` : undefined,
        format: photo.format,
        webPath: photo.webPath
      };
    }

    // Web fallback: Prompt user via hidden file input
    return new Promise<CapturedImage>((resolve, reject) => {
      if (typeof document === "undefined") {
        reject(new Error("DOM document unavailable for file input fallback."));
        return;
      }

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment";

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error("No image selected."));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const format = file.type.split("/")[1] ?? "jpeg";
          const base64Index = result.indexOf(";base64,");
          const base64String = base64Index !== -1 ? result.substring(base64Index + 8) : "";

          resolve({
            base64String,
            dataUrl: result,
            format,
            webPath: URL.createObjectURL(file)
          });
        };
        reader.onerror = () => reject(new Error("Failed reading photo file."));
        reader.readAsDataURL(file);
      };

      input.click();
    });
  }

  async pickFromGallery(): Promise<CapturedImage> {
    if (Capacitor.isNativePlatform()) {
      const photo = await Camera.getPhoto({
        allowEditing: false,
        quality: 85,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });

      return {
        base64String: photo.base64String,
        dataUrl: photo.base64String ? `data:image/${photo.format};base64,${photo.base64String}` : undefined,
        format: photo.format,
        webPath: photo.webPath
      };
    }

    return this.capturePhoto();
  }
}
