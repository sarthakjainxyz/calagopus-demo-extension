import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';
import {
  AdminDemoConfiguration,
  AdminDemoConfigurationCreate,
  adminDemoConfigurationCreateSchema,
  adminDemoConfigurationSchema,
} from '../../lib/schema.ts';

export default async (payload: AdminDemoConfigurationCreate): Promise<AdminDemoConfiguration> => {
  const { data } = await axiosInstance.post(
    '/api/admin/extensions/xyz.stellarstudios.demo/demo-configurations',
    serializeForApi(adminDemoConfigurationCreateSchema, payload),
  );

  return parseFromApi(adminDemoConfigurationSchema, data.demo_configuration);
};
