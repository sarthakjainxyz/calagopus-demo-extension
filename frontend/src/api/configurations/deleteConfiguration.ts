import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/extensions/xyz.stellarstudios.demo/demo-configurations/${uuid}`);
};
