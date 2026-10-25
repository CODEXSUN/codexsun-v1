import { Share, type ShareOptions } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

export class ShareAdapter {
  async canShare(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await Share.canShare();
        return res.value;
      } catch {
        return false;
      }
    }
    return typeof navigator !== "undefined" && typeof navigator.share === "function";
  }

  async share(options: ShareOptions): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share(options);
        return true;
      } catch {
        return false;
      }
    }

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        const shareData: ShareData = {};
        if (options.title !== undefined) shareData.title = options.title;
        if (options.text !== undefined) shareData.text = options.text;
        if (options.url !== undefined) shareData.url = options.url;
        await navigator.share(shareData);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }
}
