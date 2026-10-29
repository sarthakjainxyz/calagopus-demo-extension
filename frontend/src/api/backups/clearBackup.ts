import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';
import { AdminDemoConfiguration, adminDemoConfigurationSchema } from '../../lib/schema.ts';

export default async (uuid: string): Promise<AdminDemoConfiguration> => {
  const { data } = await axiosInstance.delete(
    `/api/admin/extensions/xyz.stellarstudios.demo/demo-configurations/${uuid}/backup`,
  );

  return parseFromApi(adminDemoConfigurationSchema, data.demo_configuration);
};
