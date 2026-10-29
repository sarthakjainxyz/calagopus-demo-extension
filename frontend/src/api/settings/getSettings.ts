import { axiosInstance } from '@/api/axios.ts';

export interface DemoExtensionSettings {
  alert_enabled: boolean;
  alert_style: 'info' | 'success' | 'warning' | 'error';
  alert_title: string | null;
  alert_title_translations: Record<string, string>;
  alert_message: string | null;
  alert_message_translations: Record<string, string>;
}

export default async function getSettings(): Promise<DemoExtensionSettings> {
  const { data } = await axiosInstance.get('/api/admin/extensions/xyz.stellarstudios.demo/settings');
  return data.settings;
}
