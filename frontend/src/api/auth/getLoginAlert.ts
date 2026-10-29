import { axiosInstance } from '@/api/axios.ts';

export interface LoginAlertData {
  enabled: boolean;
  style: 'info' | 'success' | 'warning' | 'error';
  title: string | null;
  title_translations: Record<string, string>;
  message: string | null;
  message_translations: Record<string, string>;
}

export default async function getLoginAlert(): Promise<LoginAlertData> {
  const { data } = await axiosInstance.get('/api/auth/extensions/xyz.stellarstudios.demo/alert');
  return data;
}
