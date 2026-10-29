import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';
import { AdminDemoConfiguration, adminDemoConfigurationSchema } from '../../lib/schema.ts';

export default async (
  uuid: string,
  payload: { serverUuid: string; name?: string },
): Promise<AdminDemoConfiguration> => {
  const { data } = await axiosInstance.post(
    `/api/admin/extensions/xyz.stellarstudios.demo/demo-configurations/${uuid}/duplicate`,
    {
      server_uuid: payload.serverUuid,
      name: payload.name || undefined,
    },
  );

  return parseFromApi(adminDemoConfigurationSchema, data.demo_configuration);
};
