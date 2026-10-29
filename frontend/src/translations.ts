import { defineTranslations } from 'shared';

const translations = defineTranslations({
  items: {},
  translations: {
    common: {
      button: {
        link: 'Link',
        back: 'Back to Demo Configurations',
        linkBackup: 'Link Existing Backup',
        takeBackup: 'Take New Backup',
        retakeBackup: 'Retake Backup',
        unlinkBackup: 'Unlink Backup',
      },
      toast: {
        created: 'Demo configuration created and permissions synced for all users.',
        updated: 'Configuration saved and permissions synced for all users.',
        deleted: 'Demo configuration deleted and demo subusers removed.',
        duplicated: 'Demo configuration duplicated successfully.',
        backupTaken: 'Backup creation initiated. It will be detached upon completion.',
        backupLinked: 'Backup linked successfully.',
        backupUnlinked: 'Backup unlinked from demo configuration.',
        restoreStarted: 'Backup restore initiated.',
      },
    },
    pages: {
      admin: {
        configuration: {
          information: {
            title: 'Information',
            description:
              'Thank you for installing the Demo Environment extension! If you have any questions, feedback or issues, feel free to reach out.',
            version: 'You are currently using version {current} (latest is {latest}).',
            button: {
              joinDiscord: 'Join our Discord',
              github: 'GitHub',
            },
          },
          alertSettings: {
            title: 'Authentication Alert',
            enabled: 'Enable Authentication Alert',
            saved: 'Settings saved successfully.',
          },
          configurations: {
            title: 'Demo Server Configurations',
            badge: {
              missingBackup: 'Missing Backup',
              noBackup: 'No Backup',
            },
            table: {
              permissions: 'Permissions',
              restoreInterval: 'Restore Interval',
              lastRestored: 'Last Restored',
            },
          },
          form: {
            createTitle: 'Create Demo Configuration',
            basicInfo: 'Basic Information',
            serverDetails: 'Demo Server',
            subuserPermissions: 'Subuser Permissions',
            subuserPermissionsDesc:
              'Select the permissions granted to newly created accounts and existing accounts on this server. Saving will automatically synchronize these permissions to all users!',
            serverPlaceholder: 'Select Server',
            deleteModalTitle: 'Delete Demo Configuration',
            deleteModalDesc:
              'Are you sure you want to delete this demo configuration? All granted demo subuser permissions on this server will be removed.',
          },
          backups: {
            title: 'Backup & Automated Restores',
            automatedRestoresDesc: 'Automatically restores the server to the selected backup at regular intervals.',
            enableAutomatedRestores: 'Enable Automated Restores',
            restoreInterval: 'Restore Interval (seconds)',
            restoreIntervalDesc: 'Server will be automatically restored from the demo backup every {interval}.',
            backup: 'Backup',
            linkedBadge: 'Linked',
            pendingBadge: 'Preparing Backup...',
            noBackupBadge: 'No Backup',
            noBackup: 'No backup linked yet. Link an existing detached backup or take a new one.',
            createFirstNotice: 'You can link or take a demo backup after saving this configuration.',
            retakeConfirmTitle: 'Retake Backup',
            retakeConfirm:
              'A backup is already linked. Taking a new backup will detach the previous backup from this configuration and attach the newly taken one once completed. Do you want to proceed?',
            unlinkConfirmTitle: 'Unlink Backup',
            unlinkConfirm:
              'Are you sure you want to unlink the backup from this configuration? The backup itself will not be deleted.',
            restoreConfirmTitle: 'Restore Backup Now',
            restoreConfirm:
              'Are you sure you want to restore the server from this backup right now? Current server contents will be overwritten.',
          },
          modals: {
            duplicate: {
              title: 'Duplicate Demo Configuration',
              desc: 'This will create a new demo configuration with the same permissions and restore interval settings as {name}.',
              name: 'New Configuration Name',
              targetServer: 'Target Server',
            },
            link: {
              title: 'Link Existing Backup',
              desc: 'Select a detached backup to attach to {name}. This backup must not be attached to any server.',
              empty: 'No detached backups found. Create a backup on a server first or take a new one.',
              selectLabel: 'Existing Backup',
              selectPlaceholder: 'Select an existing backup...',
            },
          },
        },
      },
    },
  },
});

export const useExtTranslations = translations.useTranslations.bind(translations);
export const getExtTranslations = translations.getTranslations.bind(translations);

export default translations;
