import { z } from "zod";

/** Schema for updating own profile. Password is optional (only when changing). */
export const profileUpdateSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    address: z.string().optional(),
    age: z.coerce.number().int().min(0).max(150).optional().nullable(),
    birthday: z.string().optional().nullable(),
    password: z.string().min(8, "Password must be at least 8 characters").optional(),
  })
  .refine(
    (data) => {
      if (!data.birthday) return true;
      const d = new Date(data.birthday);
      return !Number.isNaN(d.getTime());
    },
    { message: "Invalid birthday", path: ["birthday"] }
  );

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
