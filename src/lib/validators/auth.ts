import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const pinSchema = z.object({
  pin: z
    .string()
    .min(4, 'PIN must be 4-6 digits')
    .max(6, 'PIN must be 4-6 digits')
    .regex(/^\d+$/, 'PIN must contain only digits'),
})

export type PinInput = z.infer<typeof pinSchema>

export const staffCreateSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'manager', 'cashier'], {
    required_error: 'Role is required',
  }),
  pin: z
    .string()
    .min(4, 'PIN must be 4-6 digits')
    .max(6, 'PIN must be 4-6 digits')
    .regex(/^\d+$/, 'PIN must contain only digits'),
  branch_id: z.string().uuid('Invalid branch'),
})

export type StaffCreateInput = z.infer<typeof staffCreateSchema>

export const staffUpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  role: z.enum(['admin', 'manager', 'cashier']).optional(),
  active: z.boolean().optional(),
  pin: z
    .string()
    .min(4)
    .max(6)
    .regex(/^\d+$/)
    .optional(),
})

export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>
