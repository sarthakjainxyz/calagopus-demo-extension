import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getAdminServers from '@/api/admin/servers/getServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import duplicateConfiguration from '../api/configurations/duplicateConfiguration.ts';
import { AdminDemoConfiguration } from '../lib/schema.ts';
import { useExtTranslations } from '../translations.ts';

interface Props {
  demoConfiguration: AdminDemoConfiguration;
  opened: boolean;
  onClose: () => void;
}

export default function DuplicateDemoConfigurationModal({ demoConfiguration, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [targetServerUuid, setTargetServerUuid] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [duplicating, setDuplicating] = useState<boolean>(false);

  useEffect(() => {
    if (opened) {
      setTargetServerUuid('');
      setName(`${demoConfiguration.name} (Copy)`);
    }
  }, [opened, demoConfiguration.name]);

  const serverFetcher = useCallback((search: string) => getAdminServers(1, search), []);

  const doDuplicate = () => {
    if (!targetServerUuid) return;

    setDuplicating(true);
    duplicateConfiguration(demoConfiguration.uuid, {
      serverUuid: targetServerUuid,
      name: name || undefined,
    })
      .then((created) => {
        addToast(tExt('common.toast.duplicated', {}), 'success');
        onClose();
        navigate(`/admin/extensions/xyz.stellarstudios.demo/${created.uuid}`);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setDuplicating(false));
  };

  return (
    <Modal opened={opened} onClose={onClose} title={tExt('pages.admin.configuration.modals.duplicate.title', {})}>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          {tExt('pages.admin.configuration.modals.duplicate.desc', { name: demoConfiguration.name })}
        </Text>

        <ServerSelect<z.infer<typeof adminServerSchema>>
          withAsterisk
          label={tExt('pages.admin.configuration.modals.duplicate.targetServer', {})}
          placeholder={tExt('pages.admin.configuration.modals.duplicate.targetServer', {})}
          queryKey={queryKeys.admin.servers.all()}
          fetcher={serverFetcher}
          value={targetServerUuid || null}
          onChange={(uuid, server) => {
            setTargetServerUuid(uuid ?? '');
            if (server && !name) {
              setName(`${server.name} Demo`);
            }
          }}
        />

        <TextInput
          withAsterisk
          label={tExt('pages.admin.configuration.modals.duplicate.name', {})}
          placeholder={tExt('pages.admin.configuration.modals.duplicate.name', {})}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />

        <ModalFooter>
          <Button color='blue' onClick={doDuplicate} loading={duplicating} disabled={!targetServerUuid || !name.trim()}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={onClose} disabled={duplicating}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
