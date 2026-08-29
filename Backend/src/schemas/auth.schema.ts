import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const password = z.string().min(1, "Enter your password.").max(128);

export const loginSchema = z.object({
  email,
  password,
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must contain at least 2 characters.").max(100),
  email,
  password: password
    .min(12, "Password must contain at least 12 characters.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character."),
});
