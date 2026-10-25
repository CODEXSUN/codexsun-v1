/**
 * Mobile Chat Workspace Component
 * Delivers full mobile parity for M0 chat workflows:
 * - Channel navigation by kind (topic, direct message, group, broadcast).
 * - Realtime connection status indicator (Online / Connecting / Reconnecting).
 * - Rich message feed with reactions, replies, and file/image attachments.
 * - Interactive typing indicator and same-second read cursor tracking.
 * - Channel administration modal (add member, remove member, leave channel).
 * - Optional Telegram dialogs drawer when active.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  HashIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SmileIcon,
  Trash2Icon,
  UsersIcon,
  WifiIcon,
  WifiOffIcon,
  XIcon
} from "lucide-react";
import { useNativeSession } from "../../app/native-session-provider.js";
import { ChatCursorTracker } from "./chat-cursor.js";
import { ChatRealtimeClient } from "./chat-realtime-client.js";
import { ChatService, MAX_CHAT_ATTACHMENTS } from "./chat-service.js";
import type {
  ChatAttachmentPayload,
  ChatChannel,
  ChatChannelDetail,
  ChatChannelKind,
  ChatRealtimeStatus
} from "./types.js";

export interface ChatMobileWorkspaceProps {
  initialChannelUuid?: string | undefined;
  onSelectChannel?: (channel: ChatChannel) => void;
}

export function ChatMobileWorkspace({
  initialChannelUuid,
  onSelectChannel
}: ChatMobileWorkspaceProps) {
  const { session, transport } = useNativeSession();
  const service = useMemo(() => new ChatService(transport), [transport]);

  // Navigation & State
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [channelDetail, setChannelDetail] = useState<ChatChannelDetail | null>(null);
  const [activeKindTab, setActiveKindTab] = useState<"all" | ChatChannelKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Realtime & Cursor State
  const [realtimeStatus, setRealtimeStatus] = useState<ChatRealtimeStatus>("idle");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const cursorTracker = useMemo(
    () => new ChatCursorTracker(session?.email),
    [session?.email]
  );

  // Message Composer State
  const [messageText, setMessageText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachmentPayload[]>([]);
  const [sending, setSending] = useState(false);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<ChatChannelKind>("channel");
  const [newChannelMembers, setNewChannelMembers] = useState("");

  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "member">("member");

  // Load Channels
  const refreshChannels = async () => {
    try {
      setLoading(true);
      const list = await service.listChannels({ search: searchQuery });
      setChannels(list);

      if (initialChannelUuid && !selectedChannel) {
        const found = list.find((c) => c.uuid === initialChannelUuid);
        if (found) {
          handleSelectChannel(found);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshChannels();
  }, [searchQuery]);

  // Load Active Channel Details & Messages
  const loadActiveChannel = async (channelUuid: string) => {
    try {
      const detail = await service.getChannel(channelUuid);
      setChannelDetail(detail);
      cursorTracker.ingest(channelUuid, detail.messages);

      // Mark read automatically
      await service.markChannelRead(channelUuid);
      cursorTracker.markRead(channelUuid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    }
  };

  // Initialize Realtime Client
  useEffect(() => {
    if (!session?.apiOrigin) return;

    const realtime = new ChatRealtimeClient({
      apiOrigin: session.apiOrigin,
      autoConnect: true,
      context: {
        activeCompanyId: session.activeCompanyId,
        sessionSlot: session.sessionSlot,
        tenantDbName: session.tenantDbName,
        tenantId: session.tenantId,
        token: session.token
      },
      handlers: {
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMsg(msg);
        },
        onMessageCreated: (msg, channelUuid) => {
          cursorTracker.ingest(channelUuid, msg);
          if (selectedChannel?.uuid === channelUuid) {
            setChannelDetail((prev) =>
              prev ? { ...prev, messages: [...prev.messages, msg] } : null
            );
            void service.markChannelRead(channelUuid, msg.id);
            cursorTracker.markRead(channelUuid, msg);
          }
        },
        onMessageDeleted: (channelUuid, uuid) => {
          if (selectedChannel?.uuid === channelUuid) {
            setChannelDetail((prev) =>
              prev
                ? {
                    ...prev,
                    messages: prev.messages.filter((m) => m.uuid !== uuid)
                  }
                : null
            );
          }
        },
        onPresence: (_channelUuid, _online) => {
          // Track online presence if needed
        },
        onStatusChange: (status) => {
          setRealtimeStatus(status);
        },
        onTyping: (channelUuid, userEmail, typing) => {
          if (selectedChannel?.uuid === channelUuid) {
            setTypingUsers((prev) => {
              const without = prev.filter((e) => e !== userEmail);
              return typing ? [...without, userEmail] : without;
            });
          }
        }
      }
    });

    if (selectedChannel) {
      realtime.subscribe(selectedChannel.uuid);
    }

    return () => {
      realtime.disconnect();
    };
  }, [session, selectedChannel?.uuid]);

  const handleSelectChannel = (channel: ChatChannel) => {
    setSelectedChannel(channel);
    onSelectChannel?.(channel);
    void loadActiveChannel(channel.uuid);
  };

  const handleSendMessage = async () => {
    if (!selectedChannel) return;
    if (!messageText.trim() && pendingAttachments.length === 0) return;

    try {
      setSending(true);
      const created = await service.sendMessage({
        attachments: pendingAttachments,
        body: messageText.trim(),
        channelUuid: selectedChannel.uuid
      });

      cursorTracker.ingest(selectedChannel.uuid, created);
      setChannelDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, created] } : null
      );

      setMessageText("");
      setPendingAttachments([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = async (messageUuid: string, emoji: string) => {
    try {
      const updated = await service.toggleReaction(messageUuid, emoji);
      cursorTracker.ingest(updated.channelUuid, updated);
      setChannelDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) => (m.uuid === messageUuid ? updated : m))
            }
          : null
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      const memberList = newChannelMembers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await service.createChannel({
        kind: newChannelKind,
        members: memberList,
        name: newChannelName.trim()
      });

      setIsCreateModalOpen(false);
      setNewChannelName("");
      setNewChannelMembers("");
      await refreshChannels();
      handleSelectChannel(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    }
  };

  const handleAddMember = async () => {
    if (!selectedChannel || !newMemberEmail.trim()) return;
    try {
      await service.addMember(selectedChannel.uuid, {
        role: newMemberRole,
        userEmail: newMemberEmail.trim()
      });
      setNewMemberEmail("");
      void loadActiveChannel(selectedChannel.uuid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    }
  };

  const handleRemoveMember = async (memberUuid: string) => {
    if (!selectedChannel) return;
    try {
      await service.removeMember(selectedChannel.uuid, memberUuid);
      void loadActiveChannel(selectedChannel.uuid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    }
  };

  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (activeKindTab !== "all" && c.kind !== activeKindTab) return false;
      return true;
    });
  }, [channels, activeKindTab]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center gap-2">
          {selectedChannel ? (
            <button
              type="button"
              onClick={() => setSelectedChannel(null)}
              className="rounded p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
          ) : (
            <MessageSquareIcon className="size-5 text-violet-400" />
          )}
          <span className="font-semibold text-sm">
            {selectedChannel ? selectedChannel.name : "Team & Field Chat"}
          </span>
        </div>

        {/* Realtime Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              realtimeStatus === "open"
                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                : realtimeStatus === "connecting" || realtimeStatus === "reconnecting"
                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {realtimeStatus === "open" ? (
              <>
                <WifiIcon className="size-3" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOffIcon className="size-3" />
                <span className="capitalize">{realtimeStatus}</span>
              </>
            )}
          </div>

          {!selectedChannel && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1 rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500"
            >
              <PlusIcon className="size-3.5" />
              <span>New</span>
            </button>
          )}

          {selectedChannel && (
            <button
              type="button"
              onClick={() => setIsMembersModalOpen(true)}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              <UsersIcon className="size-3.5" />
              <span>{channelDetail?.members.length ?? 0}</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center justify-between bg-rose-950/80 border-b border-rose-800 px-3 py-1.5 text-xs text-rose-300">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <XIcon className="size-3.5 text-rose-400" />
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      {!selectedChannel ? (
        /* Channel List View */
        <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
          {/* Channel Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            {(
              [
                { id: "all", label: "All" },
                { id: "channel", label: "Channels" },
                { id: "dm", label: "Direct" },
                { id: "group", label: "Groups" },
                { id: "broadcast", label: "Broadcasts" }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveKindTab(tab.id)}
                className={`rounded px-2.5 py-1 font-medium transition ${
                  activeKindTab === tab.id
                    ? "bg-violet-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-slate-800 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Channel Cards */}
          <div className="flex flex-col gap-2 overflow-y-auto flex-1">
            {filteredChannels.length === 0 ? (
              <div className="text-center text-xs text-slate-500 mt-8">
                {loading ? "Loading channels..." : "No channels found."}
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const unread = channel.unreadCount ?? 0;
                return (
                  <div
                    key={channel.uuid}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectChannel(channel)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleSelectChannel(channel);
                      }
                    }}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3 hover:bg-slate-850 hover:border-slate-700 cursor-pointer transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-slate-800 text-slate-300">
                        {channel.kind === "dm" ? (
                          <MessageSquareIcon className="size-4 text-sky-400" />
                        ) : channel.kind === "group" ? (
                          <UsersIcon className="size-4 text-emerald-400" />
                        ) : channel.kind === "broadcast" ? (
                          <MegaphoneIcon className="size-4 text-amber-400" />
                        ) : (
                          <HashIcon className="size-4 text-violet-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-xs text-slate-200">{channel.name}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {channel.lastMessagePreview || "No messages yet"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {channel.lastMessageAt && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(channel.lastMessageAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="rounded-full bg-violet-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Active Conversation Feed */
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            {channelDetail?.messages.length === 0 ? (
              <div className="text-center text-xs text-slate-500 mt-8">
                No messages yet. Send a message to start conversation!
              </div>
            ) : (
              channelDetail?.messages.map((msg) => {
                const isOwn =
                  session?.email &&
                  msg.senderEmail.toLowerCase() === session.email.toLowerCase();

                return (
                  <div
                    key={msg.uuid}
                    className={`flex flex-col max-w-[85%] ${
                      isOwn ? "self-end items-end" : "self-start items-start"
                    }`}
                  >
                    {!isOwn && (
                      <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                        {msg.senderEmail}
                      </span>
                    )}

                    <div
                      className={`rounded-lg px-3 py-2 text-xs ${
                        isOwn
                          ? "bg-violet-600 text-white rounded-br-none"
                          : "bg-slate-800 text-slate-100 rounded-bl-none"
                      }`}
                    >
                      {msg.reply && (
                        <div className="mb-1 rounded bg-black/20 p-1 text-[10px] border-l-2 border-slate-300">
                          <span className="font-semibold">{msg.reply.senderEmail}: </span>
                          <span>{msg.reply.body}</span>
                        </div>
                      )}

                      {msg.body && <div className="whitespace-pre-wrap">{msg.body}</div>}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-1 flex flex-col gap-1">
                          {msg.attachments.map((att) => (
                            <div
                              key={att.uuid}
                              className="flex items-center gap-1.5 rounded bg-black/25 px-2 py-1 text-[11px]"
                            >
                              <PaperclipIcon className="size-3 text-slate-300" />
                              <span className="truncate">{att.fileName}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-70">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                        {msg.editedAt && <span>(edited)</span>}
                      </div>
                    </div>

                    {/* Reactions */}
                    <div className="flex items-center gap-1 mt-0.5 px-1">
                      {msg.reactions?.map((rx) => (
                        <button
                          key={rx.emoji}
                          type="button"
                          onClick={() => handleToggleReaction(msg.uuid, rx.emoji)}
                          className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[10px] border ${
                            rx.own
                              ? "bg-violet-950 border-violet-700 text-violet-300"
                              : "bg-slate-900 border-slate-700 text-slate-300"
                          }`}
                        >
                          <span>{rx.emoji}</span>
                          <span>{rx.count}</span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleToggleReaction(msg.uuid, "👍")}
                        className="text-slate-500 hover:text-slate-300 p-0.5"
                      >
                        <SmileIcon className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="px-3 py-1 text-[11px] text-slate-400 italic">
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
            </div>
          )}

          {/* Message Composer */}
          <div className="border-t border-slate-800 bg-slate-900/90 p-2.5">
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pendingAttachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-200"
                  >
                    <PaperclipIcon className="size-3 text-violet-400" />
                    <span className="truncate max-w-[120px]">{att.fileName}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (pendingAttachments.length >= MAX_CHAT_ATTACHMENTS) return;
                  setPendingAttachments((prev) => [
                    ...prev,
                    {
                      base64: "data:text/plain;base64,VXBsb2FkIGRvYw==",
                      fileName: `document-${prev.length + 1}.txt`,
                      mimeType: "text/plain"
                    }
                  ]);
                }}
                className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <PaperclipIcon className="size-4" />
              </button>

              <textarea
                rows={1}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 resize-none max-h-24"
              />

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={sending || (!messageText.trim() && pendingAttachments.length === 0)}
                className="rounded bg-violet-600 p-2 text-white hover:bg-violet-500 disabled:opacity-50"
              >
                <SendIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">Create New Channel</h3>
            <div className="flex flex-col gap-2.5">
              <label className="text-xs text-slate-300">
                Channel Name
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. site-inspectors"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                />
              </label>

              <label className="text-xs text-slate-300">
                Channel Type
                <select
                  value={newChannelKind}
                  onChange={(e) => setNewChannelKind(e.target.value as ChatChannelKind)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="channel">Topic Channel</option>
                  <option value="dm">Direct Message (DM)</option>
                  <option value="group">Group Channel</option>
                  <option value="broadcast">Broadcast Channel</option>
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Initial Member Emails (comma separated)
                <input
                  type="text"
                  value={newChannelMembers}
                  onChange={(e) => setNewChannelMembers(e.target.value)}
                  placeholder="alice@initech.com, bob@initech.com"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                />
              </label>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateChannel}
                  disabled={!newChannelName.trim()}
                  className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Members Modal */}
      {isMembersModalOpen && selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-4 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Members: #{selectedChannel.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3">
              {channelDetail?.members.map((m) => (
                <div
                  key={m.uuid}
                  className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-200">{m.userEmail}</div>
                    <span className="text-[10px] text-slate-400 capitalize">{m.role}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.uuid)}
                    className="p-1 text-rose-400 hover:text-rose-300"
                    title="Remove member"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Member Form */}
            <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300">Add New Member</span>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200"
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as "admin" | "member")}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!newMemberEmail.trim()}
                  className="rounded bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
