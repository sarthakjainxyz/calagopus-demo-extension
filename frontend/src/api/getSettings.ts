import { z } from 'zod';
import { untransformedAxiosInstance } from '@/api/axios.ts';
import { transformKeysToCamelCase } from '@/lib/transformers.ts';
import { adminExtensionSettingsSchema } from '../lib/schema.ts';

export default async (): Promise<z.infer<typeof adminExtensionSettingsSchema>> => {
  return new Promise((resolve, reject) => {
    untransformedAxiosInstance
      .get('/api/admin/extensions/xyz.stellarstudios.demo/settings')
      .then(({ data }) =>
        resolve(transformKeysToCamelCase(data.settings) as z.infer<typeof adminExtensionSettingsSchema>),
      )
      .catch(reject);
  });
};
