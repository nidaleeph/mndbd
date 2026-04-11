import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    ministryIds: z.array(z.string().min(1)).min(1, "Pick at least one ministry"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  isAdmin: z.boolean().optional().default(false),
  ministryAssignments: z
    .array(
      z.object({
        ministryId: z.string().min(1),
        role: z.enum(["head", "member"]).default("member"),
      })
    )
    .optional()
    .default([]),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  age: z.number().int().optional(),
  birthday: z.coerce.date().optional(),
  isAdmin: z.boolean().optional(),
  status: z.enum(["pending", "active", "inactive"]).optional(),
  ministryAssignments: z
    .array(
      z.object({
        ministryId: z.string().min(1),
        role: z.enum(["head", "member"]),
      })
    )
    .optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type UserCreateFormData = z.infer<typeof userCreateSchema>;
export type UserUpdateFormData = z.infer<typeof userUpdateSchema>;
