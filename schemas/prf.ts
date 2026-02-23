import { z } from "zod";

export const prfSchema = z.object({
  ministryId: z.string().min(1, "Ministry is required"),
  requestDate: z.coerce.date(),
  amountRequested: z.number().positive("Amount must be positive"),
  purpose: z.string().min(1, "Purpose is required"),
  justification: z.string().min(1, "Justification is required"),
  status: z.enum(["draft", "pending", "approved", "rejected"]).optional().default("draft"),
});

export type PRFFormData = z.infer<typeof prfSchema>;
