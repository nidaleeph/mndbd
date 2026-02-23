"use client";

import Link from "next/link";
import { ExpandableTable } from "@/features/shared/ExpandableTable";
import { FormActionsCell, type RowActions } from "@/features/shared/FormActionsCell";
import { Badge } from "@/components/ui";

type SongType = {
  id: string;
  section: string;
  title: string;
  youtubeLink: string | null;
};

type InstrumentAssignmentType = {
  instrumentId: string;
  instrument: { name: string };
  user: { id: string; name: string };
};

type SingerAssignmentType = {
  singerRoleId: string;
  singerRole: { name: string };
  user: { id: string; name: string };
};

type LineupWithRelations = {
  id: string;
  eventName: string;
  date: Date;
  status: string;
  ministry: { name: string };
  createdBy: { name: string };
  songs: SongType[];
  instrumentAssignments: InstrumentAssignmentType[];
  singerAssignments: SingerAssignmentType[];
  _actions?: RowActions;
};

interface LineupTableClientProps {
  lineups: LineupWithRelations[];
}

export function LineupTableClient({ lineups }: LineupTableClientProps) {
  const columns = [
    {
      id: "eventName",
      header: "Event",
      cell: (row: LineupWithRelations) => (
        <Link
          href={`/dashboard/lineup/${row.id}`}
          className="text-[var(--color-primary)] hover:underline"
        >
          {row.eventName}
        </Link>
      ),
    },
    {
      id: "ministry",
      header: "Ministry",
      cell: (row: LineupWithRelations) => row.ministry.name,
    },
    {
      id: "date",
      header: "Date",
      cell: (row: LineupWithRelations) => new Date(row.date).toLocaleDateString(),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: LineupWithRelations) => (
        <Badge
          variant={
            row.status === "Approved"
              ? "success"
              : row.status === "Pending Approval"
                ? "warning"
                : row.status === "Draft"
                  ? "info"
                  : "default"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      id: "createdBy",
      header: "Created by",
      cell: (row: LineupWithRelations) => row.createdBy.name,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row: LineupWithRelations) =>
        row._actions ? (
          <FormActionsCell
            entityType="lineup"
            entityId={row.id}
            editHref={`/dashboard/lineup/${row.id}/edit`}
            actions={row._actions}
          />
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        ),
    },
  ];

  function renderDetail(row: LineupWithRelations) {
    const joyfulSongs = row.songs.filter((s) => s.section === "Joyful");
    const solemnSongs = row.songs.filter((s) => s.section === "Solemn");

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/dashboard/lineup/${row.id}`}
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View full details
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Created by</h4>
            <p className="text-sm">{row.createdBy.name}</p>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Joyful</h4>
            <ul className="space-y-1">
              {joyfulSongs.length === 0 ? (
                <li className="text-sm text-[var(--color-text-muted)]">None</li>
              ) : (
                joyfulSongs.map((s) => (
                  <li key={s.id}>
                    {s.youtubeLink ? (
                      <a
                        href={s.youtubeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-primary)] hover:underline"
                      >
                        {s.title}
                      </a>
                    ) : (
                      <span className="text-sm">{s.title}</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Solemn</h4>
            <ul className="space-y-1">
              {solemnSongs.length === 0 ? (
                <li className="text-sm text-[var(--color-text-muted)]">None</li>
              ) : (
                solemnSongs.map((s) => (
                  <li key={s.id}>
                    {s.youtubeLink ? (
                      <a
                        href={s.youtubeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-primary)] hover:underline"
                      >
                        {s.title}
                      </a>
                    ) : (
                      <span className="text-sm">{s.title}</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Musicians</h4>
            <ul className="space-y-1">
              {row.instrumentAssignments.length === 0 ? (
                <li className="text-sm text-[var(--color-text-muted)]">None</li>
              ) : (
                row.instrumentAssignments.map((a) => (
                  <li key={a.instrumentId} className="text-sm">
                    <strong>{a.instrument.name}</strong>: {a.user.name}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">Singers</h4>
            <ul className="space-y-1">
              {row.singerAssignments.length === 0 ? (
                <li className="text-sm text-[var(--color-text-muted)]">None</li>
              ) : (
                row.singerAssignments.map((a) => (
                  <li key={a.singerRoleId} className="text-sm">
                    <strong>{a.singerRole.name}</strong>: {a.user.name}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ExpandableTable
      columns={columns}
      data={lineups}
      keyExtractor={(row) => row.id}
      renderDetail={renderDetail}
      emptyMessage="No lineups yet."
    />
  );
}
