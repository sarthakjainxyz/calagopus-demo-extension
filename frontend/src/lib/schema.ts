import { z } from 'zod';

export const adminExtensionSettingsSchema = z.object({
  serverUuids: z.array(z.string()),
  permissions: z.array(z.string()),
});
