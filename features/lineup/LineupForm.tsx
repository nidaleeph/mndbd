"use client";

import { useState, useEffect, useCallback } from "react";
import { useDrag, useDrop } from "react-dnd";
import { useRouter } from "next/navigation";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button, Input, Select } from "@/components/ui";
import { lineupSchema, type LineupFormData, type SongFormData } from "@/schemas/lineup";

/** Client-side id for stable React keys and drag/drop; stripped before API submit */
type SongFormDataWithId = SongFormData & { id: string };
/** Form state uses string for date (HTML input type="date" format) */
type LineupFormState = Omit<LineupFormData, "date" | "joyfulSongs" | "solemnSongs"> & {
  date: string;
  joyfulSongs: SongFormDataWithId[];
  solemnSongs: SongFormDataWithId[];
};
import type { SelectOption } from "@/components/ui/Select";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { LuGripVertical } from "react-icons/lu";

/** Ensures each song has a stable id for keys and drag/drop */
function withIds(songs: SongFormData[], section: "Joyful" | "Solemn"): SongFormDataWithId[] {
  return songs.map((s, i) =>
    "id" in s && typeof (s as SongFormDataWithId).id === "string"
      ? (s as SongFormDataWithId)
      : { ...s, id: `song-${section}-${i}-${Date.now()}` }
  );
}

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
          data: LineupFormState & {
            songs?: { title: string; youtubeLink?: string; order: number; section: string }[];
          }
        ) => {
          // API returns flat songs array; split by section and sort by order
          const allSongs = data.songs ?? [];
          const joyful = allSongs
            .filter((s: { section: string }) => s.section === "Joyful")
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order);
          const solemn = allSongs
            .filter((s: { section: string }) => s.section === "Solemn")
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order);
          setFormData({
            eventName: data.eventName,
            date: data.date != null ? String(data.date).slice(0, 10) : "",
            ministryId: data.ministryId,
            status: (data.status as LineupFormData["status"]) ?? "Draft",
            joyfulSongs: withIds(
              joyful.map((s: { title: string; youtubeLink?: string; order: number }) => ({
                title: s.title,
                youtubeLink: s.youtubeLink ?? "",
                order: s.order,
                section: "Joyful" as const,
              })),
              "Joyful"
            ),
            solemnSongs: withIds(
              solemn.map((s: { title: string; youtubeLink?: string; order: number }) => ({
                title: s.title,
                youtubeLink: s.youtubeLink ?? "",
                order: s.order,
                section: "Solemn" as const,
              })),
              "Solemn"
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
          id: `song-${section}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title: "",
          youtubeLink: "",
          order: prev[section].length,
          section: section === "joyfulSongs" ? "Joyful" : "Solemn",
        },
      ],
    }));
  }

  /** Reorder a song within its section (used by drag-and-drop) */
  function reorderSong(section: "joyfulSongs" | "solemnSongs", fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setFormData((prev) => {
      const arr = [...prev[section]];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return {
        ...prev,
        [section]: arr.map((s, i) => ({ ...s, order: i })),
      };
    });
  }

  function removeSong(section: "joyfulSongs" | "solemnSongs", index: number) {
    setFormData((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })), // Preserves id for stable keys
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
    // Strip client-side ids before API submit
    const songsForApi = (songs: SongFormDataWithId[]): SongFormData[] =>
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id stripped for API
      songs.map(({ id, ...s }) => s);
    const parsed = lineupSchema.safeParse({
      ...dataToSubmit,
      joyfulSongs: songsForApi(formData.joyfulSongs),
      solemnSongs: songsForApi(formData.solemnSongs),
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

  const handleAddJoyful = () => addSong("joyfulSongs");
  const handleAddSolemn = () => addSong("solemnSongs");
  const handleRemoveJoyful = (i: number) => removeSong("joyfulSongs", i);
  const handleRemoveSolemn = (i: number) => removeSong("solemnSongs", i);
  const handleUpdateJoyful = (i: number, f: keyof SongFormData, v: string | number) =>
    updateSong("joyfulSongs", i, f, v);
  const handleUpdateSolemn = (i: number, f: keyof SongFormData, v: string | number) =>
    updateSong("solemnSongs", i, f, v);
  const handleCancel = () => router.back();

  return (
    <DndProvider backend={HTML5Backend}>
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
          <Input
            label="Date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
          />
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
          section="joyfulSongs"
          onAdd={handleAddJoyful}
          onRemove={handleRemoveJoyful}
          onUpdate={handleUpdateJoyful}
          onReorder={reorderSong}
        />
        <SongSection
          title="Solemn Songs"
          songs={formData.solemnSongs}
          section="solemnSongs"
          onAdd={handleAddSolemn}
          onRemove={handleRemoveSolemn}
          onUpdate={handleUpdateSolemn}
          onReorder={reorderSong}
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
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </DndProvider>
  );
}

const DRAG_TYPE_JOYFUL = "song-joyful";
const DRAG_TYPE_SOLEMN = "song-solemn";

interface DragItem {
  type: string;
  index: number;
  section: "joyfulSongs" | "solemnSongs";
  id: string;
}

function DraggableSongRow({
  song,
  index,
  section,
  title,
  onUpdate,
  onRemove,
  onReorder,
}: {
  song: SongFormDataWithId;
  index: number;
  section: "joyfulSongs" | "solemnSongs";
  title: string;
  onUpdate: (index: number, field: keyof SongFormData, value: string | number) => void;
  onRemove: (index: number) => void;
  onReorder: (section: "joyfulSongs" | "solemnSongs", fromIndex: number, toIndex: number) => void;
}) {
  const dragType = section === "joyfulSongs" ? DRAG_TYPE_JOYFUL : DRAG_TYPE_SOLEMN;

  const [{ isDragging }, drag] = useDrag({
    type: dragType,
    item: (): DragItem => ({ type: dragType, index, section, id: song.id }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [, drop] = useDrop<DragItem, void>({
    accept: dragType,
    hover: (item) => {
      if (item.index !== index) {
        onReorder(section, item.index, index);
        item.index = index;
      }
    },
  });

  const setRef = useCallback(
    (node: HTMLLIElement | null) => {
      drag(drop(node));
    },
    [drag, drop]
  );

  return (
    <li
      ref={setRef}
      className={`flex items-center gap-2 rounded border border-gray-200 p-2 transition-opacity ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
      style={{ cursor: "grab" }}
    >
      <span className="cursor-grab touch-none text-gray-400" aria-hidden>
        <LuGripVertical className="size-5" />
      </span>
      <div className="flex flex-1 items-center gap-2">
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
      </div>
      <Button
        type="button"
        variant="icon"
        aria-label={`Remove song ${index + 1}`}
        onClick={() => onRemove(index)}
        icon={<FiTrash2 className="size-4" />}
      />
    </li>
  );
}

function SongSection({
  title,
  songs,
  section,
  onAdd,
  onRemove,
  onUpdate,
  onReorder,
}: {
  title: string;
  songs: SongFormDataWithId[];
  section: "joyfulSongs" | "solemnSongs";
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof SongFormData, value: string | number) => void;
  onReorder: (section: "joyfulSongs" | "solemnSongs", fromIndex: number, toIndex: number) => void;
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
          <DraggableSongRow
            key={song.id}
            song={song}
            index={index}
            section={section}
            title={title}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onReorder={onReorder}
          />
        ))}
      </ul>
    </div>
  );
}
