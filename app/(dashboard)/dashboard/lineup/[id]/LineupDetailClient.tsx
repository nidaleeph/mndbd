"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Avatar } from "@/components/ui";

interface ChatMessage {
  id: string;
  body: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export function LineupDetailClient({
  lineupId,
  userId,
  userName = "",
  pusherKey,
  pusherCluster,
}: {
  lineupId: string;
  userId: string;
  userName?: string;
  pusherKey: string;
  pusherCluster: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    fetch(`/api/lineup/${lineupId}/chat`)
      .then((r) => r.json())
      .then((data: ChatMessage[]) => {
        const arr = Array.isArray(data) ? data : [];
        const seen = new Set<string>();
        setMessages(
          arr.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          })
        );
      })
      .catch(() => {});
  }, [lineupId]);

  useEffect(() => {
    if (!pusherKey || !pusherCluster) return;
    let cancelled = false;
    let pusherInstance: InstanceType<typeof import("pusher-js").default> | null = null;
    import("pusher-js").then((mod) => {
      if (cancelled) return;
      pusherInstance = new mod.default(pusherKey, { cluster: pusherCluster });
      const channel = pusherInstance.subscribe(`chat-${lineupId}`);
      channel.bind("message", (payload: ChatMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      });
      channel.bind("typing", () => setTyping(true));
      channel.bind("stop-typing", () => setTyping(false));
    });
    return () => {
      cancelled = true;
      pusherInstance?.unsubscribe(`chat-${lineupId}`);
    };
  }, [lineupId, pusherKey, pusherCluster]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lineup/${lineupId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (data.id) {
        const newMsg: ChatMessage = {
          id: data.id,
          body: data.body,
          userId: data.userId,
          userName: data.userName ?? "You",
          createdAt: data.createdAt,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setNewMessage("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Chat" className="sticky top-20 flex h-[400px] flex-col">
      <ul className="min-h-0 flex-1 space-y-2 overflow-auto">
        {messages.map((m) => {
          const isOwn = m.userId === userId;
          const displayName = isOwn ? "You" : m.userName;
          const avatarName = isOwn ? userName || "You" : m.userName;
          return (
            <li key={m.id} className={`flex w-full gap-2 ${isOwn ? "justify-end" : ""}`}>
              <Avatar name={avatarName} size="sm" className="shrink-0" />
              <div
                className={`max-w-[85%] min-w-0 rounded-lg px-3 py-2 ${
                  isOwn ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-soft-blue-bg)]"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    isOwn ? "text-white" : "text-[var(--color-text-dark)]"
                  }`}
                >
                  {displayName}
                </p>
                <p
                  className={`text-sm ${
                    isOwn ? "text-white/95" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {m.body}
                </p>
                <p
                  className={`text-xs ${
                    isOwn ? "text-white/80" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {new Date(m.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </li>
          );
        })}
        {typing && (
          <li key="typing" className="text-sm text-[var(--color-text-muted)]">
            Someone is typing...
          </li>
        )}
        <li key="scroll-anchor" ref={bottomRef} aria-hidden="true" />
      </ul>
      <form onSubmit={handleSend} className="mt-2 flex gap-2">
        <label htmlFor="lineup-chat-input" className="sr-only">
          Type a message
        </label>
        <input
          id="lineup-chat-input"
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 rounded-[var(--radius)] border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
        />
        <Button type="submit" variant="primary" loading={loading} disabled={!newMessage.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}
