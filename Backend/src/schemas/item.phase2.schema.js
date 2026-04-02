import { z } from 'zod';

export const hybridSearchQuerySchema = z.object({
    q: z.string().min(1, 'Search query is required'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
});

export const suggestionQuerySchema = z.object({
    q: z.string().min(1, 'Suggestion query is required'),
});

export const relatedParamsSchema = z.object({
    id: z.string().min(1),
});

export const graphItemParamsSchema = z.object({
    itemId: z.string().min(1),
});

export const graphExpandQuerySchema = z.object({
    centralNodeId: z.string().min(1, 'centralNodeId is required'),
    depth: z.coerce.number().int().positive().max(5).optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    cursor: z.string().trim().min(1).optional(),
});

export const resurfacingQuerySchema = z.object({
    days: z
        .string()
        .optional()
        .transform((v) => (v ? v.split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n) && n > 0) : [7, 30, 60])),
});

export const uploadItemBodySchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    collectionId: z.string().trim().optional(),
});

const extensionMetadataSchema = z.object({
    source: z.string().trim().max(100).optional(),
    domain: z.string().trim().max(255).optional(),
    selectedText: z.string().trim().max(10000).optional(),
    screenshotDataUrl: z.string().trim().max(10_000_000).optional(),
    tabTitle: z.string().trim().max(500).optional(),
    tabUrl: z.string().trim().max(2048).optional(),
    capturedAt: z.string().datetime().optional(),
});

export const extensionItemBodySchema = z.object({
    type: z.enum(['url', 'text', 'image', 'pdf', 'tweet']).default('url'),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).optional(),
    content: z.string().trim().max(50000).optional(),
    url: z.string().trim().max(2048).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    collectionId: z.string().trim().optional(),
    metadata: extensionMetadataSchema.optional(),
});

export const extensionBulkBodySchema = z.object({
    items: z.array(extensionItemBodySchema).min(1).max(25),
});
