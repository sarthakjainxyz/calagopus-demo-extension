import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';
import { AdminDemoConfiguration, adminDemoConfigurationSchema } from '../../lib/schema.ts';

export default async (uuid: string, backupUuid: string): Promise<AdminDemoConfiguration> => {
  const { data } = await axiosInstance.post(
    `/api/admin/extensions/xyz.stellarstudios.demo/demo-configurations/${uuid}/backup/link`,
    { backup_uuid: backupUuid },
  );

  return parseFromApi(adminDemoConfigurationSchema, data.demo_configuration);
};
