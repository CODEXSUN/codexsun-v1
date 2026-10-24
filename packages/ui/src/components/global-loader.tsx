import "./global-loader.css";
import { cn } from "../lib/utils";

type GlobalLoaderProps = {
  className?: string;
  fullScreen?: boolean;
  message?: string;
  steady?: boolean;
};

export function GlobalLoader({
  className,
  fullScreen = true,
  message = "Loading…",
  steady = false
}: GlobalLoaderProps) {
  return (
    <div
      className={cn(
        "global-loader",
        fullScreen ? "global-loader-fullscreen" : "global-loader-inline",
        steady && "global-loader-steady",
        className
      )}
    >
      <div className="global-loader-mark" aria-hidden="true">
        <div className="global-loader-core" />
        <div className="global-loader-ring global-loader-ring-accent" />
        <div className="global-loader-ring global-loader-ring-dark" />
        <div className="global-loader-ring global-loader-ring-soft" />
        <div className="global-loader-logo" aria-hidden="true">
          <img
            className="global-loader-logo-light"
            width={41}
            height={41}
            src="/logo/logo.svg"
            alt=""
          />
          <img
            className="global-loader-logo-dark"
            width={41}
            height={41}
            src="/logo/logo-dark.svg"
            alt=""
          />
        </div>
      </div>
      <p className="global-loader-message" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
