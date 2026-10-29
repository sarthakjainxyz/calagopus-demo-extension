import { z } from 'zod';
import { nullableString } from '@/lib/serialization/transformers.ts';

export const adminDemoConfigurationBackupSchema = z.object({
  uuid: z.string().uuid(),
  name: z.preprocess(nullableString, z.string().nullable().optional()),
  checksum: z.preprocess(nullableString, z.string().nullable().optional()),
  bytes: z.number().nullable().optional(),
  files: z.number().nullable().optional(),
  completed: z.coerce.date().nullable().optional(),
  detached: z.boolean(),
});

export type AdminDemoConfigurationBackup = z.infer<typeof adminDemoConfigurationBackupSchema>;

export const adminDemoConfigurationSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  serverUuid: z.string(),
  serverName: z.preprocess(nullableString, z.string().nullable().optional()),
  permissions: z.array(z.string()),
  backupEnabled: z.boolean(),
  restoreInterval: z.number().nullable().default(3600),
  backup: adminDemoConfigurationBackupSchema.nullable().optional(),
  lastRestore: z.coerce.date().nullable(),
  created: z.coerce.date(),
  updated: z.coerce.date(),
});

export type AdminDemoConfiguration = z.infer<typeof adminDemoConfigurationSchema>;

export const adminDemoConfigurationListItemSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  serverUuid: z.string(),
  serverName: z.preprocess(nullableString, z.string().nullable().optional()),
  permissions: z.array(z.string()),
  backupEnabled: z.boolean(),
  restoreInterval: z.number().nullable().default(3600),
  hasBackup: z.boolean().default(false),
  lastRestore: z.coerce.date().nullable(),
  created: z.coerce.date(),
  updated: z.coerce.date(),
});

export type AdminDemoConfigurationListItem = z.infer<typeof adminDemoConfigurationListItemSchema>;

export const adminDemoConfigurationCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  serverUuid: z.string().uuid({ message: 'Enter a valid server UUID' }),
  permissions: z.array(z.string()),
  backupEnabled: z.boolean().optional(),
  restoreInterval: z.number().min(1).nullable().optional(),
});

export type AdminDemoConfigurationCreate = z.infer<typeof adminDemoConfigurationCreateSchema>;

export const adminDemoConfigurationUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()).optional(),
  permissions: z.array(z.string()).optional(),
  backupEnabled: z.boolean().optional(),
  restoreInterval: z.number().min(1).nullable().optional(),
});

export type AdminDemoConfigurationUpdate = z.infer<typeof adminDemoConfigurationUpdateSchema>;

export const existingBackupSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  bytes: z.number(),
  created: z.coerce.date(),
});

export type ExistingBackup = z.infer<typeof existingBackupSchema>;
