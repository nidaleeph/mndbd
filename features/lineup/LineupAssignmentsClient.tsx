"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Section, Button } from "@/components/ui";
import { Select, type SelectOption } from "@/components/ui/Select";
import { FiTrash2 } from "react-icons/fi";

/** Instrument assignment with instrument and user info for display */
interface InstrumentAssignmentDisplay {
  instrumentId: string;
  instrument: { name: string };
  user: { id: string; name: string };
}

/** Singer assignment with singer role and user info for display */
interface SingerAssignmentDisplay {
  singerRoleId: string;
  singerRole: { name: string };
  user: { id: string; name: string };
}

interface LineupAssignmentsClientProps {
  lineupId: string;
  canEdit: boolean;
  instrumentAssignments: InstrumentAssignmentDisplay[];
  singerAssignments: SingerAssignmentDisplay[];
  ministryId: string;
}

/**
 * Client component for adding/removing musicians (instrument assignments)
 * and singers (singer role assignments) on a lineup detail page.
 * Shown only when canEdit is true.
 */
export function LineupAssignmentsClient({
  lineupId,
  canEdit,
  instrumentAssignments: initialInstrumentAssignments,
  singerAssignments: initialSingerAssignments,
  ministryId,
}: LineupAssignmentsClientProps) {
  const router = useRouter();
  const [instrumentAssignments, setInstrumentAssignments] = useState(initialInstrumentAssignments);
  const [singerAssignments, setSingerAssignments] = useState(initialSingerAssignments);

  const [instruments, setInstruments] = useState<SelectOption[]>([]);
  const [singerRoles, setSingerRoles] = useState<SelectOption[]>([]);
  const [users, setUsers] = useState<SelectOption[]>([]);
  /** Map of id -> name for optimistic updates */
  const [instrumentsById, setInstrumentsById] = useState<Record<string, string>>({});
  const [singerRolesById, setSingerRolesById] = useState<Record<string, string>>({});
  const [usersById, setUsersById] = useState<Record<string, string>>({});

  const [selectedInstrumentId, setSelectedInstrumentId] = useState("");
  const [selectedMusicianUserId, setSelectedMusicianUserId] = useState("");
  const [selectedSingerRoleId, setSelectedSingerRoleId] = useState("");
  const [selectedSingerUserId, setSelectedSingerUserId] = useState("");

  const [addMusicianLoading, setAddMusicianLoading] = useState(false);
  const [addSingerLoading, setAddSingerLoading] = useState(false);
  const [removeMusicianLoading, setRemoveMusicianLoading] = useState<string | null>(null);
  const [removeSingerLoading, setRemoveSingerLoading] = useState<string | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sync with server state when parent re-renders (e.g. after router.refresh)
  useEffect(() => {
    queueMicrotask(() => {
      setInstrumentAssignments(initialInstrumentAssignments);
      setSingerAssignments(initialSingerAssignments);
    });
  }, [initialInstrumentAssignments, initialSingerAssignments]);

  // Fetch instruments, singer roles, and users for dropdowns when canEdit
  useEffect(() => {
    if (!canEdit) return;

    const usersUrl = ministryId
      ? `/api/options/users?ministryId=${encodeURIComponent(ministryId)}`
      : "/api/options/users";

    Promise.all([
      fetch("/api/settings/instruments")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load instruments"))))
        .then((list: { id: string; name: string }[]) =>
          list.map((i) => ({ value: i.id, label: i.name }))
        ),
      fetch("/api/settings/singer-roles")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load singer roles"))))
        .then((list: { id: string; name: string }[]) =>
          list.map((s) => ({ value: s.id, label: s.name }))
        ),
      fetch(usersUrl)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load users"))))
        .then((list: { id: string; name: string; email: string }[]) => ({
          options: list.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
          byId: Object.fromEntries(list.map((u) => [u.id, u.name])),
        })),
    ])
      .then(([inst, roles, usrsData]) => {
        setInstruments(inst);
        setSingerRoles(roles);
        setUsers(usrsData.options);
        setInstrumentsById(Object.fromEntries(inst.map((i) => [i.value, i.label])));
        setSingerRolesById(Object.fromEntries(roles.map((r) => [r.value, r.label])));
        setUsersById(usrsData.byId);
        setFetchError(null);
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : "Failed to load options");
      });
  }, [canEdit, ministryId]);

  const addMusician = useCallback(() => {
    if (!selectedInstrumentId || !selectedMusicianUserId) return;
    const instrumentName = instrumentsById[selectedInstrumentId];
    const userName = usersById[selectedMusicianUserId];
    setAddMusicianLoading(true);
    fetch(`/api/lineup/${lineupId}/instruments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrumentId: selectedInstrumentId, userId: selectedMusicianUserId }),
    })
      .then((r) => {
        if (!r.ok)
          return r
            .json()
            .then((d) => Promise.reject(new Error((d as { error?: string }).error ?? "Failed")));
        // Optimistic update: show new assignment immediately
        setInstrumentAssignments((prev) => [
          ...prev,
          {
            instrumentId: selectedInstrumentId,
            instrument: { name: instrumentName ?? "Instrument" },
            user: { id: selectedMusicianUserId, name: userName ?? "User" },
          },
        ]);
        setSelectedInstrumentId("");
        setSelectedMusicianUserId("");
        router.refresh();
      })
      .catch(() => {
        setAddMusicianLoading(false);
      })
      .finally(() => {
        setAddMusicianLoading(false);
      });
  }, [lineupId, selectedInstrumentId, selectedMusicianUserId, instrumentsById, usersById, router]);

  const addSinger = useCallback(() => {
    if (!selectedSingerRoleId || !selectedSingerUserId) return;
    const roleName = singerRolesById[selectedSingerRoleId];
    const userName = usersById[selectedSingerUserId];
    setAddSingerLoading(true);
    fetch(`/api/lineup/${lineupId}/singers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ singerRoleId: selectedSingerRoleId, userId: selectedSingerUserId }),
    })
      .then((r) => {
        if (!r.ok)
          return r
            .json()
            .then((d) => Promise.reject(new Error((d as { error?: string }).error ?? "Failed")));
        // Optimistic update: show new assignment immediately
        setSingerAssignments((prev) => [
          ...prev,
          {
            singerRoleId: selectedSingerRoleId,
            singerRole: { name: roleName ?? "Role" },
            user: { id: selectedSingerUserId, name: userName ?? "User" },
          },
        ]);
        setSelectedSingerRoleId("");
        setSelectedSingerUserId("");
        router.refresh();
      })
      .catch(() => {
        setAddSingerLoading(false);
      })
      .finally(() => {
        setAddSingerLoading(false);
      });
  }, [lineupId, selectedSingerRoleId, selectedSingerUserId, singerRolesById, usersById, router]);

  const removeMusician = useCallback(
    (instrumentId: string) => {
      setRemoveMusicianLoading(instrumentId);
      const url = `/api/lineup/${lineupId}/instruments?instrumentId=${encodeURIComponent(instrumentId)}`;
      fetch(url, { method: "DELETE" })
        .then((r) => {
          if (!r.ok)
            return r
              .json()
              .then((d) => Promise.reject(new Error((d as { error?: string }).error ?? "Failed")));
          // Optimistic update: remove from list immediately
          setInstrumentAssignments((prev) => prev.filter((a) => a.instrumentId !== instrumentId));
          router.refresh();
        })
        .finally(() => {
          setRemoveMusicianLoading(null);
        });
    },
    [lineupId, router]
  );

  const removeSinger = useCallback(
    (singerRoleId: string) => {
      setRemoveSingerLoading(singerRoleId);
      const url = `/api/lineup/${lineupId}/singers?singerRoleId=${encodeURIComponent(singerRoleId)}`;
      fetch(url, { method: "DELETE" })
        .then((r) => {
          if (!r.ok)
            return r
              .json()
              .then((d) => Promise.reject(new Error((d as { error?: string }).error ?? "Failed")));
          // Optimistic update: remove from list immediately
          setSingerAssignments((prev) => prev.filter((a) => a.singerRoleId !== singerRoleId));
          router.refresh();
        })
        .finally(() => {
          setRemoveSingerLoading(null);
        });
    },
    [lineupId, router]
  );

  const handleInstrumentChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedInstrumentId(e.target.value);
  }, []);

  const handleMusicianUserChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMusicianUserId(e.target.value);
  }, []);

  const handleSingerRoleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSingerRoleId(e.target.value);
  }, []);

  const handleSingerUserChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSingerUserId(e.target.value);
  }, []);

  if (!canEdit) {
    return null;
  }

  return (
    <>
      <Section title="Instruments">
        <Card>
          <ul className="space-y-2">
            {instrumentAssignments.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">No assignments</li>
            ) : (
              instrumentAssignments.map((a) => (
                <li key={a.instrumentId} className="flex items-center justify-between gap-2">
                  <span>
                    <strong>{a.instrument.name}</strong>: {a.user.name}
                  </span>
                  <Button
                    variant="icon"
                    icon={<FiTrash2 className="size-4" />}
                    aria-label={`Remove ${a.user.name} from ${a.instrument.name}`}
                    disabled={removeMusicianLoading === a.instrumentId}
                    onClick={() => removeMusician(a.instrumentId)}
                  />
                </li>
              ))
            )}
          </ul>
          {fetchError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {fetchError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <Select
                label="Instrument"
                options={instruments}
                value={selectedInstrumentId}
                onChange={handleInstrumentChange}
              />
            </div>
            <div className="min-w-[200px]">
              <Select
                label="Musician"
                options={users}
                value={selectedMusicianUserId}
                onChange={handleMusicianUserChange}
              />
            </div>
            <Button
              onClick={addMusician}
              disabled={!selectedInstrumentId || !selectedMusicianUserId || addMusicianLoading}
              loading={addMusicianLoading}
            >
              Add musician
            </Button>
          </div>
        </Card>
      </Section>
      <Section title="Singers">
        <Card>
          <ul className="space-y-2">
            {singerAssignments.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">No assignments</li>
            ) : (
              singerAssignments.map((a) => (
                <li key={a.singerRoleId} className="flex items-center justify-between gap-2">
                  <span>
                    <strong>{a.singerRole.name}</strong>: {a.user.name}
                  </span>
                  <Button
                    variant="icon"
                    icon={<FiTrash2 className="size-4" />}
                    aria-label={`Remove ${a.user.name} from ${a.singerRole.name}`}
                    disabled={removeSingerLoading === a.singerRoleId}
                    onClick={() => removeSinger(a.singerRoleId)}
                  />
                </li>
              ))
            )}
          </ul>
          {fetchError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {fetchError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <Select
                label="Singer role"
                options={singerRoles}
                value={selectedSingerRoleId}
                onChange={handleSingerRoleChange}
              />
            </div>
            <div className="min-w-[200px]">
              <Select
                label="Singer"
                options={users}
                value={selectedSingerUserId}
                onChange={handleSingerUserChange}
              />
            </div>
            <Button
              onClick={addSinger}
              disabled={!selectedSingerRoleId || !selectedSingerUserId || addSingerLoading}
              loading={addSingerLoading}
            >
              Add singer
            </Button>
          </div>
        </Card>
      </Section>
    </>
  );
}
