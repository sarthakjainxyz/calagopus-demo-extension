import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';
import { AdminDemoConfigurationListItem, adminDemoConfigurationListItemSchema } from '../../lib/schema.ts';

export default async (
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<AdminDemoConfigurationListItem>> => {
  const { data } = await axiosInstance.get('/api/admin/extensions/xyz.stellarstudios.demo/demo-configurations', {
    params: {
      page,
      search: search || undefined,
      per_page: perPage,
    },
  });

  return parsePaginationFromApi(adminDemoConfigurationListItemSchema, data.demo_configurations);
};
