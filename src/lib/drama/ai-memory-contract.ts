import { z } from "zod";

const confidenceSchema = z.enum(["high", "medium", "low"]);

export const aiMemoryGenerationInputSchema = z.object({
  workTitle: z.string().trim().min(1).max(120),
  seasonNumber: z.number().int().positive().max(99),
  seriesId: z.string().trim().max(80).optional(),
  coverUrl: z.string().trim().max(5000).optional(),
  officialSynopsis: z.string().trim().max(12000),
  userContext: z.string().trim().max(12000).default(""),
  existingKeyPlots: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  existingFamousScenes: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  mainCharacters: z.array(z.string().trim().min(1).max(80)).max(30),
});

const verifiedContentSchema = z.object({
  confidence: confidenceSchema,
  seasonVerified: z.boolean(),
  sourceCount: z.number().int().min(0).max(20),
  sourceSeason: z.number().int().positive().nullable(),
  verificationReason: z.string().trim().min(1).max(240),
});

export const aiMemoryGeneratedSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  keyPlots: z
    .array(
      verifiedContentSchema.extend({
        text: z.string().trim().min(1).max(240),
      }),
    )
    .max(8),
  famousScenes: z
    .array(
      verifiedContentSchema.extend({
        title: z.string().trim().min(1).max(80),
        description: z.string().trim().max(180).optional(),
        episode: z.number().int().positive().nullable().optional(),
      }),
    )
    .max(8),
  suggestedTags: z.array(z.string().trim().min(1).max(24)).max(10),
  excludedItems: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(160),
        reason: z.string().trim().min(1).max(160),
        suspectedSeason: z.number().int().positive().nullable(),
      }),
    )
    .max(12),
});

export type AiMemoryGenerationInput = z.infer<typeof aiMemoryGenerationInputSchema>;
export type AiMemoryGenerated = z.infer<typeof aiMemoryGeneratedSchema>;

export type AiMemoryServerResult =
  | {
      ok: true;
      memory: AiMemoryGenerated;
      generatedAt: string;
      model: string;
    }
  | {
      ok: false;
      code: "insufficient_source" | "missing_api_key" | "provider_unavailable" | "rate_limited";
      message: string;
    };
