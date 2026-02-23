import { z } from "zod";

export const arfSchema = z.object({
  ministryId: z.string().min(1, "Ministry is required"),
  eventName: z.string().min(1, "Event name is required"),
  requestedDate: z.coerce.date(),
  what: z.string().min(1, "What is required"),
  when: z.string().min(1, "When is required"),
  where: z.string().min(1, "Where is required"),
  why: z.string().min(1, "Why is required"),
  justification: z.string().min(1, "Justification is required"),
  status: z.enum(["draft", "pending", "approved", "rejected"]).optional().default("draft"),
});

export type ARFFormData = z.infer<typeof arfSchema>;
