import { z } from "zod";

export const prayerSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["pending", "prayed_for"]).optional().default("pending"),
});

export type PrayerFormData = z.infer<typeof prayerSchema>;
