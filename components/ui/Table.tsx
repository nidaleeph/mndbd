import type { ReactNode } from "react";

export interface TableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data",
  className = "",
}: TableProps<T>) {
  return (
    <div
      className={`overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] ${className}`}
    >
      <table className="w-full min-w-[400px] text-left text-sm">
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft-blue-bg)]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className="px-4 py-3 font-medium text-[var(--color-text-dark)]"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-[var(--color-text-muted)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-[var(--color-soft-blue-bg)]/50">
                {columns.map((col) => (
                  <td key={col.id} className="px-4 py-3 text-[var(--color-text-dark)]">
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
