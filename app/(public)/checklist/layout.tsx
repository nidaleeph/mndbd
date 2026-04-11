import type { ReactNode } from "react";
import "./checklist.css";

export const metadata = {
  title: "Multimedia Checklist",
  description: "Sunday setup checklist for the Multimedia ministry",
};

export default function ChecklistLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
