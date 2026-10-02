import { z } from 'zod';
import { states } from './config';
export const cartSchema = z
  .array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(20) }))
  .max(50);
export const addressSchema = z.object({
  firstName: z.string().trim().min(2, 'Enter your first name').max(60),
  lastName: z.string().trim().min(2, 'Enter your last name').max(60),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+234|234|0)[789][01]\d{8}$/, 'Enter a Nigerian mobile number, e.g. 08012345678'),
  state: z.enum(states, { error: 'Choose a Nigerian state' }),
  lga: z.string().trim().max(80),
  city: z.string().trim().min(2, 'Enter your city or town').max(100),
  address: z.string().trim().min(8, 'Enter a complete delivery address').max(250),
  landmark: z.string().trim().max(150),
  instructions: z.string().trim().max(500),
});
export const checkoutSchema = addressSchema.extend({
  email: z.email('Enter a valid email').max(254),
  acceptTest: z.literal(true, { error: 'Confirm that this is an unpaid test order' }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const orderRequestSchema = z.object({
  contact: checkoutSchema,
  items: cartSchema.min(1),
  idempotencyKey: z.uuid(),
});
export const productInputSchema = z
  .object({
    name: z.string().trim().min(3).max(150),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(160),
    description: z.string().trim().min(10).max(5000),
    short_description: z.string().trim().max(250),
    category_id: z.uuid(),
    audience: z.string().min(1).max(40),
    price: z.number().int().nonnegative().max(1000000000),
    compare_at: z.number().int().nonnegative().nullable(),
    status: z.enum(['draft', 'active', 'archived']),
    tags: z.array(z.string().max(50)).max(30),
    featured: z.boolean(),
    details: z.array(z.string().max(250)).max(15),
    care: z.string().max(1000),
    seo_title: z.string().max(70).optional(),
    seo_description: z.string().max(170).optional(),
  })
  .refine((p) => p.compare_at === null || p.compare_at > p.price, {
    message: 'Previous price must exceed current price',
    path: ['compare_at'],
  });
