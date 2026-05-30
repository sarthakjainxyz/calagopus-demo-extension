import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';
import { adminExtensionSettingsSchema } from '../lib/schema.ts';

export default async (data: z.infer<typeof adminExtensionSettingsSchema>): Promise<void> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .put('/api/admin/extensions/xyz.stellarstudios.demo/settings', transformKeysToSnakeCase(data))
      .then(() => resolve())
      .catch(reject);
  });
};
