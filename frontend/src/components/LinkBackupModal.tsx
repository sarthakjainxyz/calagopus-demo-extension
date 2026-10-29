import { Select } from '@mantine/core';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import getExistingBackups from '../api/backups/getExistingBackups.ts';
import linkBackup from '../api/backups/linkBackup.ts';
import { AdminDemoConfiguration, ExistingBackup } from '../lib/schema.ts';
import { useExtTranslations } from '../translations.ts';

interface Props {
  demoConfiguration: AdminDemoConfiguration;
  opened: boolean;
  onClose: () => void;
  onSuccess: (updated: AdminDemoConfiguration) => void;
}

export default function LinkBackupModal({ demoConfiguration, opened, onClose, onSuccess }: Props) {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [backups, setBackups] = useState<ExistingBackup[]>([]);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      setSelectedUuid(null);
      return;
    }

    setLoading(true);
    getExistingBackups()
      .then((data) => {
        setBackups(data);
        if (data.length > 0 && !selectedUuid) {
          setSelectedUuid(data[0].uuid);
        }
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setLoading(false));
  }, [opened]);

  const doLink = () => {
    if (!selectedUuid) return;

    setLinking(true);
    linkBackup(demoConfiguration.uuid, selectedUuid)
      .then((updated) => {
        addToast(tExt('common.toast.backupLinked', {}), 'success');
        onSuccess(updated);
        onClose();
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setLinking(false));
  };

  const selectData = backups.map((b) => ({
    value: b.uuid,
    label: `${b.name} (${bytesToString(b.bytes)}) - ${new Date(b.created).toLocaleString()}`,
  }));

  return (
    <Modal title={tExt('pages.admin.configuration.modals.link.title', {})} opened={opened} onClose={onClose} size='lg'>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          {tExt('pages.admin.configuration.modals.link.desc', { name: demoConfiguration.name })}
        </Text>

        {loading ? (
          <div className='flex justify-center p-6'>
            <Spinner />
          </div>
        ) : backups.length === 0 ? (
          <div className='p-4 bg-(--mantine-color-dark-6) rounded-md text-center'>
            <Text size='sm' c='dimmed'>
              {tExt('pages.admin.configuration.modals.link.empty', {})}
            </Text>
          </div>
        ) : (
          <Select
            label={tExt('pages.admin.configuration.modals.link.selectLabel', {})}
            placeholder={tExt('pages.admin.configuration.modals.link.selectPlaceholder', {})}
            data={selectData}
            value={selectedUuid}
            onChange={setSelectedUuid}
            searchable
            clearable={false}
          />
        )}
      </Stack>

      <ModalFooter>
        <Button color='blue' onClick={doLink} disabled={!selectedUuid || backups.length === 0} loading={linking}>
          {tExt('common.button.link', {})}
        </Button>
        <Button variant='default' onClick={onClose} disabled={linking}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
