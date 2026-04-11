"use client";

import { useCallback, useState } from "react";
import { Button, Input, Card } from "@/components/ui";

interface Ministry {
  id: string;
  name: string;
}

interface MinistryAssignment {
  ministryId: string;
  ministryName: string;
  role: "head" | "member";
}

export interface UserFormInitial {
  id?: string;
  name: string;
  email: string;
  address?: string | null;
  age?: number | null;
  birthday?: string | null;
  isAdmin: boolean;
  status: "pending" | "active" | "inactive";
  ministries: MinistryAssignment[];
}

export interface UserFormSubmitBody {
  name?: string;
  email?: string;
  password?: string;
  address?: string;
  age?: number;
  birthday?: string;
  isAdmin?: boolean;
  status?: "pending" | "active" | "inactive";
  ministryAssignments?: { ministryId: string; role: "head" | "member" }[];
}

export interface UserFormProps {
  /** Initial values in edit mode; undefined in create mode. */
  initial?: UserFormInitial;
  /** Full list of ministries for the add-picker. */
  allMinistries: Ministry[];
  /** Whether the current editor is admin (false = ministry head). */
  editorIsAdmin: boolean;
  /** Ministries the current editor heads (for head-scoped edit). */
  editorHeadOfMinistryIds: string[];
  /** Called with the validated form body to submit. */
  onSubmit: (body: UserFormSubmitBody) => Promise<void>;
  submitLabel: string;
}

export function UserForm({
  initial,
  allMinistries,
  editorIsAdmin,
  editorHeadOfMinistryIds,
  onSubmit,
  submitLabel,
}: UserFormProps) {
  const isCreate = !initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [age, setAge] = useState<string>(initial?.age != null ? String(initial.age) : "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [isAdminFlag, setIsAdminFlag] = useState(initial?.isAdmin ?? false);
  const [status, setStatus] = useState<"pending" | "active" | "inactive">(
    initial?.status ?? "active"
  );
  const [assignments, setAssignments] = useState<MinistryAssignment[]>(initial?.ministries ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scoping for ministry head editors
  const canEditBasicInfo = editorIsAdmin;
  const canEditIsAdmin = editorIsAdmin;
  const canEditStatus = editorIsAdmin;

  const isMinistryInEditorScope = useCallback(
    (mId: string): boolean => editorIsAdmin || editorHeadOfMinistryIds.includes(mId),
    [editorIsAdmin, editorHeadOfMinistryIds]
  );

  const visibleAssignments = assignments.filter((a) => isMinistryInEditorScope(a.ministryId));

  const addableMinistries = allMinistries.filter((m) => {
    if (assignments.some((a) => a.ministryId === m.id)) return false;
    if (!editorIsAdmin && !editorHeadOfMinistryIds.includes(m.id)) return false;
    return true;
  });

  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const toggleRole = useCallback((ministryId: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.ministryId === ministryId ? { ...a, role: a.role === "head" ? "member" : "head" } : a
      )
    );
  }, []);

  const removeAssignment = useCallback((ministryId: string) => {
    setAssignments((prev) => prev.filter((a) => a.ministryId !== ministryId));
  }, []);

  const addAssignment = useCallback((ministryId: string, ministryName: string) => {
    setAssignments((prev) => [...prev, { ministryId, ministryName, role: "member" }]);
    setAddPickerOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const body: UserFormSubmitBody = {};

        if (canEditBasicInfo) {
          body.name = name.trim();
          body.email = email;
          if (address) body.address = address;
          if (age) body.age = Number(age);
          if (birthday) body.birthday = birthday;
        }
        if (canEditIsAdmin) {
          body.isAdmin = isAdminFlag;
        }
        if (canEditStatus) {
          body.status = status;
        }
        if (isCreate) {
          // Create mode requires name, email, password regardless of editor scoping
          body.name = name.trim();
          body.email = email;
          if (password) body.password = password;
        }

        if (editorIsAdmin) {
          body.ministryAssignments = assignments.map((a) => ({
            ministryId: a.ministryId,
            role: a.role,
          }));
        } else {
          body.ministryAssignments = assignments
            .filter((a) => editorHeadOfMinistryIds.includes(a.ministryId))
            .map((a) => ({ ministryId: a.ministryId, role: a.role }));
        }

        await onSubmit(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
    [
      canEditBasicInfo,
      canEditIsAdmin,
      canEditStatus,
      name,
      email,
      address,
      age,
      birthday,
      isAdminFlag,
      status,
      isCreate,
      password,
      editorIsAdmin,
      assignments,
      editorHeadOfMinistryIds,
      onSubmit,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Basic info */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Basic info</h3>
        <div className="space-y-3">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEditBasicInfo && !isCreate}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canEditBasicInfo && !isCreate}
          />
          {isCreate ? (
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
          <Input
            label="Address"
            value={address ?? ""}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!canEditBasicInfo}
          />
          <Input
            label="Age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            disabled={!canEditBasicInfo}
          />
          <Input
            label="Birthday"
            type="date"
            value={birthday ?? ""}
            onChange={(e) => setBirthday(e.target.value)}
            disabled={!canEditBasicInfo}
          />
          {canEditStatus ? (
            <div>
              <label className="mb-1 block text-xs font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "pending" | "active" | "inactive")}
                className="w-full rounded border border-[var(--color-border)] p-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          ) : null}
          {canEditIsAdmin ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isAdminFlag}
                onChange={(e) => setIsAdminFlag(e.target.checked)}
              />
              <span>Admin (global access to all ministries)</span>
            </label>
          ) : null}
        </div>
      </Card>

      {/* Ministry memberships */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">
          Ministries{" "}
          {!editorIsAdmin ? (
            <span className="text-xs font-normal text-[var(--color-text-muted)]">
              (only showing ministries you head)
            </span>
          ) : null}
        </h3>
        {visibleAssignments.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">No ministry memberships yet.</div>
        ) : (
          <div className="space-y-2">
            {visibleAssignments.map((a) => (
              <div
                key={a.ministryId}
                className="flex items-center gap-3 rounded border border-[var(--color-border)] p-2"
              >
                <span className="flex-1 text-sm">{a.ministryName}</span>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={a.role === "head"}
                    onChange={() => toggleRole(a.ministryId)}
                  />
                  <span>Head</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeAssignment(a.ministryId)}
                  className="text-red-600 hover:text-red-800"
                  aria-label={`Remove ${a.ministryName}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {addableMinistries.length > 0 ? (
          <div className="mt-3">
            {!addPickerOpen ? (
              <button
                type="button"
                onClick={() => setAddPickerOpen(true)}
                className="rounded border border-dashed border-[var(--color-primary)] px-3 py-1 text-xs text-[var(--color-primary)]"
              >
                + Add ministry
              </button>
            ) : (
              <div className="space-y-2 rounded border border-[var(--color-border)] p-2">
                <div className="mb-1 text-xs font-medium">Pick a ministry:</div>
                <div className="flex flex-wrap gap-1">
                  {addableMinistries.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addAssignment(m.id, m.name)}
                      className="rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-soft-blue-bg)]"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAddPickerOpen(false)}
                  className="text-xs text-[var(--color-text-muted)]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Card>

      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
