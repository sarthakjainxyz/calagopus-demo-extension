import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';
import { ExistingBackup, existingBackupSchema } from '../../lib/schema.ts';

const responseSchema = z.object({
  backups: z.array(existingBackupSchema),
});

export default async (): Promise<ExistingBackup[]> => {
  const { data } = await axiosInstance.get('/api/admin/extensions/xyz.stellarstudios.demo/existing');

  const parsed = parseFromApi(responseSchema, data);
  return parsed.backups;
};
