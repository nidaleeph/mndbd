"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@/components/ui";
import { prayerSchema, type PrayerFormData } from "@/schemas/prayer";

export function PrayerForm({ prayerId }: { prayerId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PrayerFormData>({
    title: "",
    description: "",
    status: "pending",
  });

  useEffect(() => {
    if (prayerId) {
      fetch(`/api/prayers/${prayerId}`)
        .then((r) => r.json())
        .then((data: PrayerFormData & { title: string; description?: string }) => {
          setFormData({
            title: data.title,
            description: data.description ?? "",
            status: (data.status as PrayerFormData["status"]) ?? "pending",
          });
        })
        .catch(() => setError("Failed to load prayer"));
    }
  }, [prayerId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = prayerSchema.safeParse(formData);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Validation failed");
      return;
    }
    setLoading(true);
    try {
      const url = prayerId ? `/api/prayers/${prayerId}` : "/api/prayers";
      const method = prayerId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Failed to save");
        return;
      }
      router.push(prayerId ? `/dashboard/prayers/${prayerId}` : "/dashboard/prayers");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Input label="Title" name="title" value={formData.title} onChange={handleChange} />
      <Textarea
        label="Description"
        name="description"
        value={formData.description ?? ""}
        onChange={handleChange}
      />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={loading}>
          {prayerId ? "Update" : "Create"} prayer
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
