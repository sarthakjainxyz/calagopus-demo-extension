import { axiosInstance } from '@/api/axios.ts';

export interface Provider {
  name: string;
  price: number;
  currency: string;
  link: string;
}

export interface ProductData {
  identifier?: string;
  name?: string;
  version: string;
  summary?: string;
  discord?: string;
  providers: Record<string, Provider>;
}

export default async (): Promise<ProductData> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .get('https://products.stellarstudios.xyz/api/calagopus/demo')
      .then(({ data }) => resolve(data))
      .catch(reject);
  });
};
