import { faCog, faRefresh, faSave, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getPermissions from '@/api/getPermissions.ts';
import Button from '@/elements/Button.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { permissionMapSchema } from '@/lib/schemas/generic.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import getSettings from './api/getSettings.ts';
import syncSubusers from './api/syncSubusers.ts';
import updateSettings from './api/updateSettings.ts';
import { adminExtensionSettingsSchema } from './lib/schema.ts';

export default function DemoConfigurationPage() {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [permissionsMap, setPermissionsMap] = useState<z.infer<typeof permissionMapSchema>>({});

  const form = useForm<z.infer<typeof adminExtensionSettingsSchema>>({
    initialValues: {
      serverUuids: [],
      permissions: [],
    },
    validate: zod4Resolver(adminExtensionSettingsSchema),
    validateInputOnBlur: true,
  });

  useEffect(() => {
    getSettings()
      .then((settings) => form.setValues(settings))
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));

    getPermissions()
      .then((data) => setPermissionsMap(data.serverPermissions))
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));
  }, []);

  const doSave = () => {
    setLoading(true);

    updateSettings(form.values)
      .then(() => addToast('Saved', 'success'))
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setLoading(false));
  };

  const doSync = () => {
    setSyncing(true);
    syncSubusers()
      .then(({ synced }) => addToast(`Synced ${synced} subuser entries`, 'success'))
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSyncing(false));
  };

  return (
    <div className='md:columns-2 gap-4 space-y-4'>
      <TitleCard title='Server Access' icon={<FontAwesomeIcon icon={faServer} />} className='w-full'>
        <Stack>
          <TagsInput
            label='Demo Server UUIDs'
            description='Enter one or more server UUIDs. New accounts will be added as subusers on each of these servers.'
            placeholder='123e4567-e89b-12d3-a456-426614174000'
            value={form.values.serverUuids}
            onChange={(value) => form.setFieldValue('serverUuids', value)}
          />

          <Button loading={loading} onClick={doSave} className='w-fit!' leftSection={<FontAwesomeIcon icon={faSave} />}>
            {t('common.button.save', {})}
          </Button>
        </Stack>
      </TitleCard>

      <TitleCard title='Sync Existing Users' icon={<FontAwesomeIcon icon={faRefresh} />} className='w-full'>
        <Stack>
          <p className='text-neutral-400 text-sm'>
            Syncs the current server list and permissions to all existing users. Users will be added as subusers on all
            configured servers with the selected permissions. Users on servers that are no longer configured will be
            removed. Permissions for already-synced users will be overwritten with the current selection.
          </p>
          <p className='text-red-400 text-sm font-medium'>This action cannot be reverted.</p>
          <Button
            loading={syncing}
            onClick={doSync}
            className='w-fit!'
            leftSection={<FontAwesomeIcon icon={faRefresh} />}
          >
            Sync Existing Users
          </Button>
        </Stack>
      </TitleCard>

      <TitleCard title='Subuser Permissions' icon={<FontAwesomeIcon icon={faCog} />} className='w-full'>
        <Stack>
          <p className='text-neutral-400 text-sm'>
            Select the permissions granted to new accounts on the demo servers.
          </p>

          <PermissionSelector
            permissionsMapType='serverPermissions'
            permissions={permissionsMap}
            selectedPermissions={form.values.permissions}
            setSelectedPermissions={(perms) => form.setFieldValue('permissions', perms)}
          />

          <Button loading={loading} onClick={doSave} className='w-fit!' leftSection={<FontAwesomeIcon icon={faSave} />}>
            {t('common.button.save', {})}
          </Button>
        </Stack>
      </TitleCard>
    </div>
  );
}
