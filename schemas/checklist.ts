import { z } from "zod";

export const checklistCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).optional(),
});

export const checklistCategoryPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((v) => v.name !== undefined || v.sortOrder !== undefined, {
    message: "Provide at least one field to update",
  });

export const checklistItemCreateSchema = z.object({
  categoryId: z.string().min(1),
  label: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
});

export const checklistItemPatchSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    categoryId: z.string().min(1).optional(),
  })
  .refine((v) => v.label !== undefined || v.sortOrder !== undefined || v.categoryId !== undefined, {
    message: "Provide at least one field to update",
  });

export type ChecklistCategoryCreateInput = z.infer<typeof checklistCategoryCreateSchema>;
export type ChecklistCategoryPatchInput = z.infer<typeof checklistCategoryPatchSchema>;
export type ChecklistItemCreateInput = z.infer<typeof checklistItemCreateSchema>;
export type ChecklistItemPatchInput = z.infer<typeof checklistItemPatchSchema>;
