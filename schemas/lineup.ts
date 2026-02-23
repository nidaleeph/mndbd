import { z } from "zod";

export const songSchema = z.object({
  title: z.string().min(1, "Title is required"),
  youtubeLink: z.string().url().optional().or(z.literal("")),
  order: z.number().int().min(0),
  section: z.enum(["Joyful", "Solemn"]),
});

export const lineupSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  date: z.coerce.date(),
  ministryId: z.string().min(1, "Ministry is required"),
  status: z.enum(["Draft", "Pending Approval", "Approved"]).default("Draft"),
  joyfulSongs: z.array(songSchema).default([]),
  solemnSongs: z.array(songSchema).default([]),
});

export type LineupFormData = z.infer<typeof lineupSchema>;
export type SongFormData = z.infer<typeof songSchema>;
