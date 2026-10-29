import { faArrowLeft, faCircleInfo, faCloudArrowUp, faServer, faUserCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Textarea } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import getAdminServers from '@/api/admin/servers/getServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import getPermissions from '@/api/getPermissions.ts';
import Button from '@/elements/buttons/Button.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { permissionMapSchema } from '@/lib/schemas/generic.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import createConfiguration from '../api/configurations/createConfiguration.ts';
import deleteConfiguration from '../api/configurations/deleteConfiguration.ts';
import updateConfiguration from '../api/configurations/updateConfiguration.ts';
import DuplicateDemoConfigurationModal from '../components/DuplicateDemoConfigurationModal.tsx';
import { AdminDemoConfiguration } from '../lib/schema.ts';
import { useExtTranslations } from '../translations.ts';
import DemoConfigurationBackups from './DemoConfigurationBackups.tsx';

const BASE_PATH = '/admin/extensions/xyz.stellarstudios.demo';

type FormValues = {
  name: string;
  description: string | null;
  serverUuid: string;
  permissions: string[];
  backupEnabled: boolean;
  restoreInterval: number | string;
};

export default function DemoConfigurationCreateOrUpdate({
  contextDemoConfiguration,
  onUpdated,
}: {
  contextDemoConfiguration?: AdminDemoConfiguration;
  onUpdated?: (updated: AdminDemoConfiguration) => void;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>({
    name: contextDemoConfiguration?.name ?? '',
    description: contextDemoConfiguration?.description ?? null,
    serverUuid: contextDemoConfiguration?.serverUuid ?? '',
    permissions: contextDemoConfiguration?.permissions ?? [],
    backupEnabled: contextDemoConfiguration?.backupEnabled ?? false,
    restoreInterval: contextDemoConfiguration?.restoreInterval ?? 3600,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [permissionsMap, setPermissionsMap] = useState<z.infer<typeof permissionMapSchema>>({});
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);
  const [permissionsExpanded, setPermissionsExpanded] = useState(false);
  const [backupsExpanded, setBackupsExpanded] = useState(!!contextDemoConfiguration?.backup);

  useEffect(() => {
    if (contextDemoConfiguration) {
      setValues({
        name: contextDemoConfiguration.name,
        description: contextDemoConfiguration.description,
        serverUuid: contextDemoConfiguration.serverUuid,
        permissions: contextDemoConfiguration.permissions,
        backupEnabled: contextDemoConfiguration.backupEnabled,
        restoreInterval: contextDemoConfiguration.restoreInterval ?? 3600,
      });
      if (contextDemoConfiguration.backup) {
        setBackupsExpanded(true);
      }
    }
  }, [contextDemoConfiguration]);

  useEffect(() => {
    getPermissions()
      .then((data) => setPermissionsMap(data.serverPermissions))
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));
  }, []);

  const serverFetcher = useCallback((search: string) => getAdminServers(1, search), []);

  const doSave = () => {
    setSaving(true);
    const intervalNumber =
      typeof values.restoreInterval === 'number'
        ? values.restoreInterval
        : parseInt(values.restoreInterval, 10) || 3600;

    if (contextDemoConfiguration) {
      updateConfiguration(contextDemoConfiguration.uuid, {
        name: values.name,
        description: values.description,
        permissions: values.permissions,
        backupEnabled: values.backupEnabled,
        restoreInterval: intervalNumber,
      })
        .then((updated) => {
          addToast(tExt('common.toast.updated', {}), 'success');
          if (onUpdated) onUpdated(updated);
        })
        .catch((err) => addToast(httpErrorToHuman(err), 'error'))
        .finally(() => setSaving(false));
    } else {
      createConfiguration({
        name: values.name,
        description: values.description,
        serverUuid: values.serverUuid,
        permissions: values.permissions,
        backupEnabled: values.backupEnabled,
        restoreInterval: intervalNumber,
      })
        .then((created) => {
          addToast(tExt('common.toast.created', {}), 'success');
          navigate(`${BASE_PATH}/${created.uuid}`);
        })
        .catch((err) => addToast(httpErrorToHuman(err), 'error'))
        .finally(() => setSaving(false));
    }
  };

  const doDelete = () => {
    if (!contextDemoConfiguration) return;

    setDeleting(true);
    deleteConfiguration(contextDemoConfiguration.uuid)
      .then(() => {
        addToast(tExt('common.toast.deleted', {}), 'success');
        navigate(BASE_PATH);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        setDeleting(false);
      });
  };

  const formBody = (
    <Stack gap='lg'>
      {contextDemoConfiguration && (
        <>
          <ConfirmationModal
            opened={openModal === 'delete'}
            onClose={() => setOpenModal(null)}
            title={tExt('pages.admin.configuration.form.deleteModalTitle', {})}
            confirm={t('common.button.delete', {})}
            onConfirmed={doDelete}
          >
            {tExt('pages.admin.configuration.form.deleteModalDesc', {
              name: contextDemoConfiguration.name,
            })}
          </ConfirmationModal>

          {openModal === 'duplicate' && (
            <DuplicateDemoConfigurationModal
              demoConfiguration={contextDemoConfiguration}
              opened={true}
              onClose={() => setOpenModal(null)}
            />
          )}
        </>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-start'>
        <TitleCard
          title={tExt('pages.admin.configuration.form.basicInfo', {})}
          icon={<FontAwesomeIcon icon={faCircleInfo} />}
        >
          <Stack gap='sm'>
            <TextInput
              withAsterisk
              label={t('common.form.name', {})}
              placeholder={t('common.form.name', {})}
              value={values.name}
              onChange={(e) => {
                const val = e.currentTarget.value;
                setValues((v) => ({ ...v, name: val }));
              }}
            />

            <Textarea
              label={t('common.form.description', {})}
              placeholder={t('common.form.description', {})}
              rows={4}
              minRows={3}
              autosize
              value={values.description ?? ''}
              onChange={(e) => {
                const val = e.currentTarget.value || null;
                setValues((v) => ({ ...v, description: val }));
              }}
            />
          </Stack>
        </TitleCard>

        <TitleCard
          title={tExt('pages.admin.configuration.form.serverDetails', {})}
          icon={<FontAwesomeIcon icon={faServer} />}
        >
          {contextDemoConfiguration ? (
            <TextInput
              disabled
              label={t('common.form.server', {})}
              value={
                contextDemoConfiguration.serverName
                  ? `${contextDemoConfiguration.serverName} (${contextDemoConfiguration.serverUuid})`
                  : contextDemoConfiguration.serverUuid
              }
            />
          ) : (
            <ServerSelect<z.infer<typeof adminServerSchema>>
              withAsterisk
              label={t('common.form.server', {})}
              placeholder={tExt('pages.admin.configuration.form.serverPlaceholder', {})}
              queryKey={queryKeys.admin.servers.all()}
              fetcher={serverFetcher}
              value={values.serverUuid || null}
              onChange={(uuid) => setValues((v) => ({ ...v, serverUuid: uuid ?? '' }))}
            />
          )}
        </TitleCard>
      </div>

      <CollapsibleSection
        icon={<FontAwesomeIcon icon={faUserCog} />}
        title={
          values.permissions.length > 0
            ? `${tExt('pages.admin.configuration.form.subuserPermissions', {})} (${values.permissions.length})`
            : tExt('pages.admin.configuration.form.subuserPermissions', {})
        }
        enabled={permissionsExpanded}
        onToggle={setPermissionsExpanded}
      >
        <Stack gap='sm' pt='xs'>
          <Text size='sm' c='dimmed'>
            {tExt('pages.admin.configuration.form.subuserPermissionsDesc', {})}
          </Text>

          <PermissionSelector
            permissionsMapType='serverPermissions'
            permissions={permissionsMap}
            selectedPermissions={values.permissions}
            setSelectedPermissions={(permissions) => setValues((v) => ({ ...v, permissions }))}
          />
        </Stack>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<FontAwesomeIcon icon={faCloudArrowUp} />}
        title={
          contextDemoConfiguration && !contextDemoConfiguration.backup
            ? `${tExt('pages.admin.configuration.backups.title', {})} (${tExt('pages.admin.configuration.backups.noBackupBadge', {})})`
            : tExt('pages.admin.configuration.backups.title', {})
        }
        enabled={backupsExpanded}
        onToggle={setBackupsExpanded}
      >
        <Stack gap='md' pt='xs'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-start'>
            <Switch
              label={tExt('pages.admin.configuration.backups.enableAutomatedRestores', {})}
              description={tExt('pages.admin.configuration.backups.automatedRestoresDesc', {})}
              checked={values.backupEnabled}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setValues((v) => ({ ...v, backupEnabled: checked }));
              }}
            />

            <NumberInput
              label={tExt('pages.admin.configuration.backups.restoreInterval', {})}
              description={tExt('pages.admin.configuration.backups.restoreIntervalDesc', {
                interval: `${values.restoreInterval}s`,
              })}
              disabled={!values.backupEnabled}
              min={1}
              placeholder='3600'
              value={values.restoreInterval}
              onChange={(val) => setValues((v) => ({ ...v, restoreInterval: val }))}
            />
          </div>

          <Divider />

          {contextDemoConfiguration ? (
            <DemoConfigurationBackups contextDemoConfiguration={contextDemoConfiguration} onUpdated={onUpdated} />
          ) : (
            <Text size='sm' c='dimmed'>
              {tExt('pages.admin.configuration.backups.createFirstNotice', {})}
            </Text>
          )}
        </Stack>
      </CollapsibleSection>

      <Group justify='space-between' mt='md'>
        <Group>
          <Button color='blue' onClick={doSave} loading={saving} disabled={!values.serverUuid || !values.name.trim()}>
            {t('common.button.save', {})}
          </Button>
          {contextDemoConfiguration && (
            <>
              <Button color='gray' variant='default' onClick={() => setOpenModal('duplicate')}>
                {t('common.button.duplicate', {})}
              </Button>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={deleting}>
                {t('common.button.delete', {})}
              </Button>
            </>
          )}
        </Group>
      </Group>
    </Stack>
  );

  if (contextDemoConfiguration) {
    return formBody;
  }

  return (
    <AdminContentContainer title={tExt('pages.admin.configuration.form.createTitle', {})}>
      <Link to={BASE_PATH} className='inline-block mb-4 text-sm text-(--mantine-color-anchor) hover:underline'>
        <FontAwesomeIcon icon={faArrowLeft} /> {tExt('common.button.back', {})}
      </Link>
      {formBody}
    </AdminContentContainer>
  );
}
