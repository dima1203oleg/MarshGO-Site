import { z } from 'zod';

export const mapAssetManifestSchema = z.object({
  schemaVersion: z.literal(1), mapDataVersion: z.string().min(1), styleVersion: z.string().min(1),
  mapDataUrl: z.string().url(),
  // All vector states must be versioned together. A partially configured map
  // would make a mode/theme switch silently reuse the wrong visual treatment.
  styles: z.object({
    MARSHGO_LIGHT: z.string().url(),
    MARSHGO_DARK: z.string().url(),
    MARSHGO_3D_LIGHT: z.string().url(),
    MARSHGO_3D_DARK: z.string().url(),
  }),
}).superRefine((manifest, context) => {
  for (const [name, url] of Object.entries(manifest.styles)) {
    if (!/(?:\/v\d+\.\d+\.\d+\/|\/20\d{2}-\d{2}-\d{2}\/)/.test(new URL(url).pathname)) {
      context.addIssue({ code: 'custom', path: ['styles', name], message: 'Map style URLs must be immutable and versioned' });
    }
  }
  if (!/(?:\/v\d+\.\d+\.\d+\/|\/20\d{2}-\d{2}-\d{2}\/)/.test(new URL(manifest.mapDataUrl).pathname)) {
    context.addIssue({ code: 'custom', path: ['mapDataUrl'], message: 'Map data URL must be immutable and versioned' });
  }
});
export type MapAssetManifest = z.infer<typeof mapAssetManifestSchema>;

export function parseMapAssetManifest(value: unknown): MapAssetManifest { return mapAssetManifestSchema.parse(value); }
