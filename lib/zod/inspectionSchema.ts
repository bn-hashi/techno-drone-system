import { z } from "zod";
import { InspectionPhase, InspectionResult } from "@/types/prisma";
import { INSPECTION_ITEM_KEYS } from "@/lib/constants/inspectionItems";

const MAX_NOTE_LENGTH = 500;

export const InspectionInputSchema = z.object({
  phase: z.enum(InspectionPhase),
  itemKey: z.enum(INSPECTION_ITEM_KEYS),
  result: z.enum(InspectionResult),
  note: z.string().max(MAX_NOTE_LENGTH).optional(),
});

export type InspectionInput = z.infer<typeof InspectionInputSchema>;

/** 点検記録リスト。同一 phase × itemKey の重複は不正入力として拒否する */
export const InspectionListSchema = z
  .array(InspectionInputSchema)
  .min(1)
  .refine(
    (items) => new Set(items.map((item) => `${item.phase}:${item.itemKey}`)).size === items.length,
    { message: "同じ点検項目が重複しています" }
  );
