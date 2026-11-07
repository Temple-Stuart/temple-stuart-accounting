/**
 * CRM-01b (Alex, 2026-11-07, ruling A) — THE TWO WRITE BODIES, as zod shapes: what PATCH and POST /api/crm/contacts accept.
 * PURE and tested on their own (src/lib/__tests__/crm02.test.ts); the route (src/app/api/crm/contacts/route.ts) parses
 * with them and answers 400 with the field on a miss.
 *
 *   PATCH { key, stage?, next_step? } — key a ContactRow.key (crm.ts contactKeyOf reads it); stage one of CRM_STAGES;
 *     next_step a string of at most CRM_NEXT_STEP_MAX characters, or null (an empty box); at least one of the two present —
 *     the retired owner PATCH's shape (src/app/api/owner/proposals/[id]/route.ts:14-18, gone with this ruling).
 *   POST { name, business?, email } — name 1–255 after trim; email the proposal form's shape; business at most 5000 or
 *     absent. The name and email shapes are COPIED from src/app/api/proposals/route.ts:46-47 (its proposalSchema is a
 *     module const, not exported): `z.string().trim().min(1).max(255)` and `z.string().trim().email().max(255)`.
 */
import { z } from 'zod';
import { CRM_NEXT_STEP_MAX, CRM_STAGES } from './crm';

export const patchContactBody = z
  .object({
    key: z.string().min(1).max(300),
    stage: z.enum(CRM_STAGES).optional(),
    next_step: z.string().max(CRM_NEXT_STEP_MAX).nullable().optional(),
  })
  .strict()
  .refine((d) => d.stage !== undefined || d.next_step !== undefined, { message: 'Provide stage and/or next_step', path: ['stage'] });
export type PatchContactBody = z.infer<typeof patchContactBody>;

export const postContactBody = z
  .object({
    name: z.string().trim().min(1).max(255), // src/app/api/proposals/route.ts:46
    business: z.string().trim().max(5000).optional(),
    email: z.string().trim().email().max(255), // src/app/api/proposals/route.ts:47
  })
  .strict();
export type PostContactBody = z.infer<typeof postContactBody>;

/** A zod miss as the house's 400 body: the first issue's field and message (bill-pay's `{ error: 'Validation', field, message }`). */
export function validationOf(error: z.ZodError): { readonly error: 'Validation'; readonly field: string; readonly message: string } {
  const issue = error.issues[0];
  return { error: 'Validation', field: issue.path.join('.') || 'body', message: issue.message };
}
