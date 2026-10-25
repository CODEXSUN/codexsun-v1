import React, { useState } from "react";
import { MessageSquareIcon, PaperclipIcon, SendIcon } from "lucide-react";
import { useNativeSession } from "../app/native-session-provider.js";
import { executeStep4ChatMessage } from "./chat-slice.js";

export function ChatView() {
  const { transport } = useNativeSession();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [messageText, setMessageText] = useState("Site visit completed. Found all specifications in order.");

  async function handleSendChat() {
    setLoading(true);
    try {
      setLog((prev) => [...prev, `Sending message with PDF attachment...`]);
      const res = await executeStep4ChatMessage(transport, {
        body: messageText
      });
      setLog((prev) => [
        ...prev,
        `✓ ${res.message}`,
        `  Channel: #${res.data.channelUuid} | Message: #${res.data.messageUuid} | Read Status: ${res.data.readStatusVerified ? "Verified (0 unread)" : "Pending"}`
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog((prev) => [...prev, `✗ Chat Error: ${msg}`]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <MessageSquareIcon className="size-4 text-violet-400" />
          Field & Team Chat
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Post realtime chat messages, upload document attachments, and verify read status.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-slate-300">
            Message Body
            <textarea
              rows={2}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
            />
          </label>

          <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
            <PaperclipIcon className="size-3.5 text-violet-400" />
            <span>Attachment: <strong>site-inspection-spec.pdf</strong> (application/pdf)</span>
          </div>

          <button
            type="button"
            onClick={handleSendChat}
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-1.5 rounded bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <SendIcon className="size-3.5" />
            {loading ? "Sending Message..." : "Send Message & Attachment"}
          </button>
        </div>
      </div>

      {log.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
          <div className="text-slate-400 font-semibold mb-1 flex items-center gap-1">
            <MessageSquareIcon className="size-3" /> Chat Log:
          </div>
          {log.map((line, i) => (
            <div key={i} className="py-0.5 whitespace-pre-wrap">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
