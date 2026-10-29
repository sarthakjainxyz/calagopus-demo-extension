CREATE TABLE "xyz_stellarstudios_demo_configurations" (
  "uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "description" text,
  "server_uuid" uuid NOT NULL,
  "permissions" text[] DEFAULT '{}'::text[] NOT NULL,
  "backup_enabled" boolean DEFAULT false NOT NULL,
  "restore_interval" bigint DEFAULT 3600 NOT NULL,
  "backup_uuid" uuid,
  "backup_detached" boolean DEFAULT false NOT NULL,
  "last_restore" timestamp,
  "created" timestamp DEFAULT now() NOT NULL,
  "updated" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "xyz_demo_configurations_server_uuid_unique" UNIQUE("server_uuid")
);

CREATE INDEX "xyz_demo_configurations_backup_enabled_idx" ON "xyz_stellarstudios_demo_configurations" ("backup_enabled");
CREATE INDEX "xyz_demo_configurations_pending_detach_idx" ON "xyz_stellarstudios_demo_configurations" ("backup_uuid") WHERE "backup_uuid" IS NOT NULL AND "backup_detached" = false;
CREATE INDEX "xyz_demo_configurations_backup_uuid_idx" ON "xyz_stellarstudios_demo_configurations" ("backup_uuid") WHERE "backup_uuid" IS NOT NULL;
ALTER TABLE "xyz_stellarstudios_demo_configurations" ADD CONSTRAINT "xyz_demo_configurations_server_uuid_fkey" FOREIGN KEY ("server_uuid") REFERENCES "servers"("uuid") ON DELETE CASCADE;
