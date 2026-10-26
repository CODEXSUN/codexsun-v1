import { formatCrmWorkTimestamps } from "./crm-time.js";
import * as React from "react";

export function PinLocationText({ value }: { value: string }) {
  const text = formatCrmWorkTimestamps(value);
  const match =
    /^(Pin Location : )?\[(-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\]\(https:\/\/www\.google\.com\/maps\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)( · Accuracy: [^\n]+ · Captured: [^\n]+)$/u.exec(
      text
    );
  if (
    !match ||
    match[2] !== match[4] ||
    match[3] !== match[5] ||
    Math.abs(Number(match[2])) > 90 ||
    Math.abs(Number(match[3])) > 180
  )
    return <React.Fragment>{text}</React.Fragment>;
  return (
    <React.Fragment>
      {match[1]}
      <a
        className="underline"
        target="_blank"
        rel="noreferrer"
        href={`https://www.google.com/maps?q=${match[2]},${match[3]}`}
      >
        {match[2]}, {match[3]}
      </a>
      {match[6]}
    </React.Fragment>
  );
}
