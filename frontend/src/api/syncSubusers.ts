import { axiosInstance } from '@/api/axios.ts';

export default async (): Promise<{ synced: number }> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .post('/api/admin/extensions/xyz.stellarstudios.demo/sync')
      .then(({ data }) => resolve(data))
      .catch(reject);
  });
};