import { Capacitor, registerPlugin } from "@capacitor/core";

export type CameraSource = "CAMERA" | "PHOTOS" | "PROMPT";
export type CameraResultType = "uri" | "base64" | "dataUrl";
export type CameraDirection = "REAR" | "FRONT";
export type CameraPermissionState = "prompt" | "prompt-with-fallback" | "granted" | "denied";

export interface CameraPermissionStatus {
  camera: CameraPermissionState;
  photos: CameraPermissionState;
}

export interface NativeCameraPhoto {
  base64String?: string | undefined;
  dataUrl?: string | undefined;
  exif?: Record<string, unknown> | undefined;
  format: string;
  path?: string | undefined;
  webPath?: string | undefined;
}

export interface CameraPlugin {
  checkPermissions(): Promise<CameraPermissionStatus>;
  getPhoto(options: {
    allowEditing?: boolean | undefined;
    correctOrientation?: boolean | undefined;
    direction?: CameraDirection | undefined;
    height?: number | undefined;
    preserveAspectRatio?: boolean | undefined;
    quality?: number | undefined;
    resultType?: CameraResultType | undefined;
    saveToGallery?: boolean | undefined;
    source?: CameraSource | undefined;
    width?: number | undefined;
  }): Promise<NativeCameraPhoto>;
  pickImages(options?: {
    height?: number | undefined;
    limit?: number | undefined;
    quality?: number | undefined;
    width?: number | undefined;
  } | undefined): Promise<{ photos: NativeCameraPhoto[] }>;
  requestPermissions(permissions?: {
    permissions: ("camera" | "photos")[];
  } | undefined): Promise<CameraPermissionStatus>;
}

export interface PhotoCaptureOptions {
  allowedMimeTypes?: string[] | undefined;
  allowEditing?: boolean | undefined;
  correctOrientation?: boolean | undefined;
  direction?: CameraDirection | undefined;
  height?: number | undefined;
  maxSizeBytes?: number | undefined;
  quality?: number | undefined;
  resultType?: CameraResultType | undefined;
  saveToGallery?: boolean | undefined;
  source?: CameraSource | undefined;
  width?: number | undefined;
}

export interface CapturedPhoto {
  base64String?: string | undefined;
  dataUrl?: string | undefined;
  format: string;
  mimeType: string;
  path?: string | undefined;
  sizeBytes: number;
  webPath?: string | undefined;
}

export interface CameraCaptureResult {
  error?: string | undefined;
  fallbackTriggered?: boolean | undefined;
  permissionDenied?: boolean | undefined;
  photo?: CapturedPhoto | undefined;
  success: boolean;
}

export interface CameraCapabilityOptions {
  allowedMimeTypes?: string[] | undefined;
  maxSizeBytes?: number | undefined;
  plugin?: CameraPlugin | undefined;
  webFallbackPicker?: (() => Promise<CapturedPhoto | null>) | undefined;
}

export const DEFAULT_MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_ALLOWED_PHOTO_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
];

function resolveMimeType(format: string): string {
  const clean = format.toLowerCase().replace(/^\.+/u, "");
  switch (clean) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return `image/${clean}`;
  }
}

function estimateByteSize(photo: NativeCameraPhoto): number {
  if (photo.base64String) {
    // Standard Base64 size estimation
    const padding = (photo.base64String.match(/=+$/u) || [""])[0].length;
    return Math.floor((photo.base64String.length * 3) / 4) - padding;
  }
  if (photo.dataUrl) {
    const commaIndex = photo.dataUrl.indexOf(",");
    if (commaIndex !== -1) {
      const base64Data = photo.dataUrl.slice(commaIndex + 1);
      const padding = (base64Data.match(/=+$/u) || [""])[0].length;
      return Math.floor((base64Data.length * 3) / 4) - padding;
    }
  }
  // Default estimate when only URI or webPath is provided
  return 1024 * 1024;
}

export class CameraCapabilityAdapter {
  private readonly plugin: CameraPlugin;
  private readonly defaultMaxSizeBytes: number;
  private readonly defaultAllowedMimes: string[];
  private readonly webFallbackPicker?: (() => Promise<CapturedPhoto | null>) | undefined;

  constructor(options: CameraCapabilityOptions = {}) {
    this.defaultMaxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_PHOTO_SIZE_BYTES;
    this.defaultAllowedMimes = options.allowedMimeTypes ?? DEFAULT_ALLOWED_PHOTO_MIMES;
    this.webFallbackPicker = options.webFallbackPicker;

    if (options.plugin) {
      this.plugin = options.plugin;
    } else if (Capacitor.isNativePlatform()) {
      this.plugin = registerPlugin<CameraPlugin>("Camera");
    } else {
      this.plugin = {
        checkPermissions: async () => ({ camera: "granted", photos: "granted" }),
        getPhoto: async () => {
          throw new Error("Web Camera plugin requires webFallbackPicker implementation.");
        },
        pickImages: async () => ({ photos: [] }),
        requestPermissions: async () => ({ camera: "granted", photos: "granted" })
      };
    }
  }

  async checkPermissions(): Promise<CameraPermissionStatus> {
    try {
      return await this.plugin.checkPermissions();
    } catch {
      return { camera: "prompt", photos: "prompt" };
    }
  }

  async requestPermissions(scope: ("camera" | "photos")[] = ["camera", "photos"]): Promise<CameraPermissionStatus> {
    try {
      return await this.plugin.requestPermissions({ permissions: scope });
    } catch {
      return { camera: "denied", photos: "denied" };
    }
  }

  validatePhoto(
    photo: { format?: string | undefined; mimeType?: string | undefined; sizeBytes: number },
    options?: { allowedMimeTypes?: string[] | undefined; maxSizeBytes?: number | undefined } | undefined
  ): { error?: string | undefined; valid: boolean } {
    const maxBytes = options?.maxSizeBytes ?? this.defaultMaxSizeBytes;
    const allowed = options?.allowedMimeTypes ?? this.defaultAllowedMimes;

    if (photo.sizeBytes > maxBytes) {
      return {
        error: `Photo size (${Math.round(photo.sizeBytes / 1024)} KB) exceeds allowable limit of ${Math.round(maxBytes / 1024)} KB.`,
        valid: false
      };
    }

    const mime = photo.mimeType ?? (photo.format ? resolveMimeType(photo.format) : "unknown");
    const isAllowed = allowed.some((type) => type.toLowerCase() === mime.toLowerCase());
    if (!isAllowed) {
      return {
        error: `Unsupported image format (${mime}). Allowed formats: ${allowed.join(", ")}.`,
        valid: false
      };
    }

    return { valid: true };
  }

  async capturePhoto(options: PhotoCaptureOptions = {}): Promise<CameraCaptureResult> {
    // 1. Check and request permissions
    const perms = await this.checkPermissions();
    if (perms.camera === "denied") {
      const requested = await this.requestPermissions(["camera"]);
      if (requested.camera === "denied") {
        return this.triggerFallback(
          "Camera access permission was denied. Falling back to alternative picker."
        );
      }
    }

    // 2. Invoke native Camera capture
    try {
      const raw = await this.plugin.getPhoto({
        allowEditing: options.allowEditing,
        correctOrientation: options.correctOrientation ?? true,
        direction: options.direction ?? "REAR",
        height: options.height,
        quality: options.quality ?? 90,
        resultType: options.resultType ?? "dataUrl",
        saveToGallery: options.saveToGallery ?? false,
        source: options.source ?? "CAMERA",
        width: options.width
      });

      const sizeBytes = estimateByteSize(raw);
      const mimeType = resolveMimeType(raw.format);

      // 3. Size and type validation
      const validation = this.validatePhoto(
        { format: raw.format, mimeType, sizeBytes },
        { allowedMimeTypes: options.allowedMimeTypes, maxSizeBytes: options.maxSizeBytes }
      );

      if (!validation.valid) {
        return {
          error: validation.error,
          success: false
        };
      }

      const photo: CapturedPhoto = {
        base64String: raw.base64String,
        dataUrl: raw.dataUrl,
        format: raw.format,
        mimeType,
        path: raw.path,
        sizeBytes,
        webPath: raw.webPath
      };

      return {
        photo,
        success: true
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (
        !Capacitor.isNativePlatform() ||
        errorMsg.toLowerCase().includes("fallback") ||
        errorMsg.toLowerCase().includes("denied") ||
        errorMsg.toLowerCase().includes("permission")
      ) {
        return this.triggerFallback(
          `Camera capture failed due to permissions: ${errorMsg}`
        );
      }
      return {
        error: errorMsg,
        success: false
      };
    }
  }

  async pickPhoto(options: PhotoCaptureOptions = {}): Promise<CameraCaptureResult> {
    return this.capturePhoto({
      ...options,
      source: "PHOTOS"
    });
  }

  async pickMultiplePhotos(
    limit = 5,
    options: PhotoCaptureOptions = {}
  ): Promise<{ error?: string | undefined; photos: CapturedPhoto[]; success: boolean }> {
    try {
      const perms = await this.checkPermissions();
      if (perms.photos === "denied") {
        const req = await this.requestPermissions(["photos"]);
        if (req.photos === "denied") {
          return {
            error: "Photo library access permission denied.",
            photos: [],
            success: false
          };
        }
      }

      const res = await this.plugin.pickImages({
        height: options.height,
        limit,
        quality: options.quality ?? 90,
        width: options.width
      });

      const validatedPhotos: CapturedPhoto[] = [];
      for (const raw of res.photos) {
        const sizeBytes = estimateByteSize(raw);
        const mimeType = resolveMimeType(raw.format);
        const valid = this.validatePhoto(
          { format: raw.format, mimeType, sizeBytes },
          { allowedMimeTypes: options.allowedMimeTypes, maxSizeBytes: options.maxSizeBytes }
        );
        if (valid.valid) {
          validatedPhotos.push({
            base64String: raw.base64String,
            dataUrl: raw.dataUrl,
            format: raw.format,
            mimeType,
            path: raw.path,
            sizeBytes,
            webPath: raw.webPath
          });
        }
      }

      return {
        photos: validatedPhotos,
        success: true
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        error: msg,
        photos: [],
        success: false
      };
    }
  }

  private async triggerFallback(reason: string): Promise<CameraCaptureResult> {
    if (this.webFallbackPicker) {
      try {
        const fallbackPhoto = await this.webFallbackPicker();
        if (fallbackPhoto) {
          return {
            fallbackTriggered: true,
            photo: fallbackPhoto,
            success: true
          };
        }
      } catch (fallbackErr: unknown) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return {
          error: `Fallback document picker failed: ${msg}`,
          fallbackTriggered: true,
          permissionDenied: true,
          success: false
        };
      }
    }

    return {
      error: reason,
      fallbackTriggered: true,
      permissionDenied: true,
      success: false
    };
  }
}
