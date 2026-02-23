"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";
import { lineupSchema, type LineupFormData, type SongFormData } from "@/schemas/lineup";

/** Form state uses string for date (HTML input type="date" format) */
type LineupFormState = Omit<LineupFormData, "date"> & { date: string };
import type { SelectOption } from "@/components/ui/Select";
import { FiPlus, FiTrash2 } from "react-icons/fi";

const STATUS_OPTIONS_CREATOR: SelectOption[] = [
  { value: "Draft", label: "Draft" },
  { value: "Pending Approval", label: "Pending Approval" },
];

const STATUS_OPTIONS_APPROVER: SelectOption[] = [
  { value: "Draft", label: "Draft" },
  { value: "Pending Approval", label: "Pending Approval" },
  { value: "Approved", label: "Approved" },
];

interface LineupFormProps {
  lineupId?: string;
  canApprove?: boolean;
  /** Music members can submit for approval; when true, show "Create lineup" button. */
  canSubmitForApproval?: boolean;
  /** When provided (create mode), ministry is fixed to Music; selector is hidden. */
  musicMinistryId?: string;
}

export function LineupForm({
  lineupId,
  canApprove = false,
  canSubmitForApproval = false,
  musicMinistryId,
}: LineupFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ministries, setMinistries] = useState<SelectOption[]>([]);
  const [formData, setFormData] = useState<LineupFormState>({
    eventName: "",
    date: new Date().toISOString().slice(0, 10),
    ministryId: musicMinistryId ?? "",
    status: "Draft",
    joyfulSongs: [],
    solemnSongs: [],
  });

  useEffect(() => {
    if (musicMinistryId) {
      setFormData((prev) => ({ ...prev, ministryId: musicMinistryId }));
    }
  }, [musicMinistryId]);

  useEffect(() => {
    fetch("/api/options/ministries")
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) =>
        setMinistries(data.map((m) => ({ value: m.id, label: m.name })))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!lineupId) return;
    fetch(`/api/lineup/${lineupId}`)
      .then((r) => r.json())
      .then(
        (
          data: LineupFormState & { joyfulSongs?: SongFormData[]; solemnSongs?: SongFormData[] }
        ) => {
          const joyful = (data.joyfulSongs ?? []).filter(
            (s: { section: string }) => s.section === "Joyful"
          );
          const solemn = (data.solemnSongs ?? []).filter(
            (s: { section: string }) => s.section === "Solemn"
          );
          setFormData({
            eventName: data.eventName,
            date: data.date != null ? String(data.date).slice(0, 10) : "",
            ministryId: data.ministryId,
            status: (data.status as LineupFormData["status"]) ?? "Draft",
            joyfulSongs: joyful.map(
              (s: { title: string; youtubeLink?: string; order: number }) => ({
                title: s.title,
                youtubeLink: s.youtubeLink ?? "",
                order: s.order,
                section: "Joyful" as const,
              })
            ),
            solemnSongs: solemn.map(
              (s: { title: string; youtubeLink?: string; order: number }) => ({
                title: s.title,
                youtubeLink: s.youtubeLink ?? "",
                order: s.order,
                section: "Solemn" as const,
              })
            ),
          });
        }
      )
      .catch(() => setError("Failed to load lineup"));
  }, [lineupId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function addSong(section: "joyfulSongs" | "solemnSongs") {
    setFormData((prev) => ({
      ...prev,
      [section]: [
        ...prev[section],
        {
          title: "",
          youtubeLink: "",
          order: prev[section].length,
          section: section === "joyfulSongs" ? "Joyful" : "Solemn",
        },
      ],
    }));
  }

  function removeSong(section: "joyfulSongs" | "solemnSongs", index: number) {
    setFormData((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })),
    }));
  }

  function updateSong(
    section: "joyfulSongs" | "solemnSongs",
    index: number,
    field: keyof SongFormData,
    value: string | number
  ) {
    setFormData((prev) => ({
      ...prev,
      [section]: prev[section].map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, createAsDraft: boolean = true) {
    e.preventDefault();
    setError(null);
    const dataToSubmit = { ...formData };
    if (musicMinistryId) dataToSubmit.ministryId = musicMinistryId;
    const parsed = lineupSchema.safeParse({
      ...dataToSubmit,
      date: new Date(formData.date),
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Validation failed");
      return;
    }
    setLoading(true);
    try {
      const url = lineupId ? `/api/lineup/${lineupId}` : "/api/lineup";
      const method = lineupId ? "PUT" : "POST";
      const status = lineupId
        ? parsed.data.status
        : createAsDraft || !canSubmitForApproval
          ? "Draft"
          : "Pending Approval";
      const finalBody = { ...parsed.data, status };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalBody),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to save");
        return;
      }
      const data = await res.json().catch(() => ({}));
      router.push(
        lineupId ? `/dashboard/lineup/${lineupId}` : `/dashboard/lineup/${data.id ?? ""}`
      );
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit(e, true);
  const handleSubmitForApproval = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>, false);
  };

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Event name"
          name="eventName"
          value={formData.eventName}
          onChange={handleChange}
        />
        <Input label="Date" name="date" type="date" value={formData.date} onChange={handleChange} />
        {!musicMinistryId && (
          <Select
            label="Ministry"
            name="ministryId"
            options={ministries}
            value={formData.ministryId}
            onChange={handleChange}
          />
        )}
        {lineupId && (
          <Select
            label="Status"
            name="status"
            options={canApprove ? STATUS_OPTIONS_APPROVER : STATUS_OPTIONS_CREATOR}
            value={formData.status}
            onChange={handleChange}
          />
        )}
      </div>
      <SongSection
        title="Joyful Songs"
        songs={formData.joyfulSongs}
        onAdd={() => addSong("joyfulSongs")}
        onRemove={(i) => removeSong("joyfulSongs", i)}
        onUpdate={(i, f, v) => updateSong("joyfulSongs", i, f, v)}
      />
      <SongSection
        title="Solemn Songs"
        songs={formData.solemnSongs}
        onAdd={() => addSong("solemnSongs")}
        onRemove={(i) => removeSong("solemnSongs", i)}
        onUpdate={(i, f, v) => updateSong("solemnSongs", i, f, v)}
      />
      <div className="flex flex-wrap gap-2">
        {!lineupId ? (
          <>
            <Button type="submit" variant="secondary" loading={loading}>
              Create as draft
            </Button>
            {canSubmitForApproval && (
              <Button
                type="button"
                variant="primary"
                loading={loading}
                onClick={handleSubmitForApproval}
              >
                Create lineup
              </Button>
            )}
          </>
        ) : (
          <Button type="submit" variant="primary" loading={loading}>
            Update
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SongSection({
  title,
  songs,
  onAdd,
  onRemove,
  onUpdate,
}: {
  title: string;
  songs: SongFormData[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof SongFormData, value: string | number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium text-[var(--color-text-dark)]">{title}</h3>
        <Button type="button" variant="ghost" icon={<FiPlus className="size-4" />} onClick={onAdd}>
          Add song
        </Button>
      </div>
      <ul className="space-y-2">
        {songs.map((song, index) => (
          <li key={`${title}-${index}`} className="flex gap-2 rounded border border-gray-200 p-2">
            <input
              type="text"
              placeholder="Title"
              value={song.title}
              onChange={(e) => onUpdate(index, "title", e.target.value)}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              aria-label={`${title} song ${index + 1} title`}
            />
            <input
              type="url"
              placeholder="YouTube link"
              value={song.youtubeLink ?? ""}
              onChange={(e) => onUpdate(index, "youtubeLink", e.target.value)}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              aria-label={`${title} song ${index + 1} YouTube link`}
            />
            <Button
              type="button"
              variant="icon"
              aria-label={`Remove song ${index + 1}`}
              onClick={() => onRemove(index)}
              icon={<FiTrash2 className="size-4" />}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
