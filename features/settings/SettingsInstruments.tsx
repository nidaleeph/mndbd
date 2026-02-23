"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { FiPlus } from "react-icons/fi";

interface Instrument {
  id: string;
  name: string;
}

export function SettingsInstruments() {
  const [list, setList] = useState<Instrument[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings/instruments")
      .then((r) => r.json())
      .then((data: Instrument[]) => setList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/settings/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setList((prev) => [...prev, created]);
        setName("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <Input
          label=""
          placeholder="Instrument name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          icon={<FiPlus className="size-4" />}
        >
          Add
        </Button>
      </form>
      <ul className="space-y-2">
        {list.map((i) => (
          <li key={i.id} className="rounded border border-gray-200 px-3 py-2">
            {i.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
