import { useRef } from "react";
import { Input } from "@codexsun/ui/components/input";

export function LeadInlineFilter({
  label,
  value,
  onChange,
  onHide
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onHide: () => void;
}) {
  const escapeStep = useRef(0);
  return (
    <Input
      aria-label={`Filter ${label}`}
      className="h-7 min-w-0 rounded-sm border-border/80 bg-white px-2 text-xs shadow-none"
      maxLength={191}
      value={value}
      onChange={(event) => {
        escapeStep.current = 0;
        onChange(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.repeat) return;
        event.preventDefault();
        event.stopPropagation();
        escapeStep.current++;
        if (escapeStep.current === 1) event.currentTarget.select();
        else if (escapeStep.current === 2) onChange("");
        else {
          escapeStep.current = 0;
          onHide();
        }
      }}
    />
  );
}
