import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';
import {
  AdminDemoConfiguration,
  AdminDemoConfigurationUpdate,
  adminDemoConfigurationSchema,
  adminDemoConfigurationUpdateSchema,
} from '../../lib/schema.ts';

export default async (uuid: string, payload: AdminDemoConfigurationUpdate): Promise<AdminDemoConfiguration> => {
  const { data } = await axiosInstance.patch(
    `/api/admin/extensions/xyz.stellarstudios.demo/demo-configurations/${uuid}`,
    serializeForApi(adminDemoConfigurationUpdateSchema, payload),
  );

  return parseFromApi(adminDemoConfigurationSchema, data.demo_configuration);
};
