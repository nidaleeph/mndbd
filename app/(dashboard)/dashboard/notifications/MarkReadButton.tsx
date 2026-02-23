"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId }),
      });
      // Refresh to update list
      window.location.reload();
    });
  }

  return (
    <Button variant="ghost" className="text-sm" onClick={handleClick} disabled={pending}>
      Mark as read
    </Button>
  );
}
