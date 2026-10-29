import { axiosInstance } from '@/api/axios.ts';
import type { DemoExtensionSettings } from './getSettings.ts';

export default async function updateSettings(settings: DemoExtensionSettings): Promise<void> {
  await axiosInstance.put('/api/admin/extensions/xyz.stellarstudios.demo/settings', settings);
}
