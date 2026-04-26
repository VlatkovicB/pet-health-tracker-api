import { z } from 'zod';

export const PlacesSearchQuerySchema = z.object({
  q: z.string().min(1, 'Missing query parameter: q'),
});
export type PlacesSearchQuery = z.infer<typeof PlacesSearchQuerySchema>;

export const PlacesDetailsQuerySchema = z.object({
  placeId: z.string().min(1, 'Missing query parameter: placeId'),
});
export type PlacesDetailsQuery = z.infer<typeof PlacesDetailsQuerySchema>;
