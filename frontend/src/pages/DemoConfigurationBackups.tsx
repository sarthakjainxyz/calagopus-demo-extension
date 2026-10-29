import { faArchive, faLink, faRotateLeft, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import getWebsocketToken from '@/api/server/getWebsocketToken.ts';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesProgressString, bytesToString } from '@/lib/format/size.ts';
import { structuredArg } from '@/plugins/websocket/args.ts';
import { SocketEvent } from '@/plugins/websocket/useWebsocketEvent.ts';
import { Websocket } from '@/plugins/websocket/Websocket.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import clearBackup from '../api/backups/clearBackup.ts';
import restoreBackup from '../api/backups/restoreBackup.ts';
import takeBackup from '../api/backups/takeBackup.ts';
import getConfiguration from '../api/configurations/getConfiguration.ts';
import LinkBackupModal from '../components/LinkBackupModal.tsx';
import { AdminDemoConfiguration } from '../lib/schema.ts';
import { useExtTranslations } from '../translations.ts';

interface Props {
  contextDemoConfiguration: AdminDemoConfiguration;
  onUpdated?: (updated: AdminDemoConfiguration) => void;
}

function parseEventUuid(arg0: unknown, arg1?: unknown): string | null {
  if (typeof arg0 === 'string') {
    if (arg0.startsWith('{')) {
      try {
        const obj = JSON.parse(arg0) as Record<string, unknown>;
        if (obj && typeof obj.uuid === 'string') return obj.uuid;
      } catch {
        // Ignore error
      }
    }
    return arg0;
  }
  if (arg0 && typeof arg0 === 'object' && 'uuid' in (arg0 as Record<string, unknown>)) {
    return String((arg0 as Record<string, unknown>).uuid);
  }
  if (arg1 && typeof arg1 === 'object' && 'uuid' in (arg1 as Record<string, unknown>)) {
    return String((arg1 as Record<string, unknown>).uuid);
  }
  return null;
}

export default function DemoConfigurationBackups({ contextDemoConfiguration, onUpdated }: Props) {
  const { addToast } = useToast();
  const { t, tItem } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const [demoConfiguration, setDemoConfiguration] = useState(contextDemoConfiguration);
  const [takingBackup, setTakingBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [openLinkModal, setOpenLinkModal] = useState(false);
  const [openRestoreModal, setOpenRestoreModal] = useState(false);
  const [openClearModal, setOpenClearModal] = useState(false);
  const [openRetakeModal, setOpenRetakeModal] = useState(false);
  const [progress, setProgress] = useState<{ progress: number; total: number; files: number } | null>(null);
  const websocketRef = useRef<Websocket | null>(null);

  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  }, [onUpdated]);

  const applyUpdatedConfig = useCallback((next: AdminDemoConfiguration) => {
    setDemoConfiguration(next);
    onUpdatedRef.current?.(next);
  }, []);

  useEffect(() => {
    setDemoConfiguration(contextDemoConfiguration);
  }, [contextDemoConfiguration]);

  useEffect(() => {
    const isPending = !!demoConfiguration.backup && !demoConfiguration.backup.detached;

    if (!isPending) {
      if (websocketRef.current) {
        websocketRef.current.removeAllListeners();
        websocketRef.current.close();
        websocketRef.current = null;
      }
      setProgress(null);
      return;
    }

    const currentBackupUuid = demoConfiguration.backup?.uuid;
    let isSubscribed = true;

    const connectWebsocket = async () => {
      try {
        const token = await getWebsocketToken(demoConfiguration.serverUuid);
        if (!isSubscribed) return;

        const socket = new Websocket(demoConfiguration.serverUuid);
        websocketRef.current = socket;

        const handleProgress = (...args: unknown[]) => {
          if (!isSubscribed) return;
          const [arg0, arg1] = args;
          const eventUuid = parseEventUuid(arg0, arg1);
          if (currentBackupUuid && eventUuid && eventUuid !== currentBackupUuid) return;
          const data = arg1 !== undefined ? arg1 : arg0;
          try {
            const parsed = structuredArg<{
              progress?: number;
              bytes_processed?: number;
              total?: number;
              bytes_total?: number;
              files?: number;
              files_processed?: number;
            }>(data);
            setProgress({
              progress: parsed.progress ?? parsed.bytes_processed ?? 0,
              total: parsed.total ?? parsed.bytes_total ?? 0,
              files: parsed.files ?? parsed.files_processed ?? 0,
            });
          } catch {
            // Ignore errors
          }
        };

        const handleCompleted = (...args: unknown[]) => {
          if (!isSubscribed) return;
          const [arg0, arg1] = args;
          const eventUuid = parseEventUuid(arg0, arg1);
          if (currentBackupUuid && eventUuid && eventUuid !== currentBackupUuid) return;
          setProgress(null);
          getConfiguration(demoConfiguration.uuid)
            .then((cfg) => {
              if (isSubscribed) {
                applyUpdatedConfig(cfg);
              }
            })
            .catch((err) => addToast(httpErrorToHuman(err), 'error'));
        };

        socket.on(SocketEvent.BACKUP_PROGRESS, handleProgress);
        socket.on(SocketEvent.BACKUP_COMPLETED, handleCompleted);

        socket.on('auth success', () => {
          if (!isSubscribed) return;
          getConfiguration(demoConfiguration.uuid)
            .then((cfg) => {
              if (isSubscribed && cfg.backup?.detached) {
                applyUpdatedConfig(cfg);
              }
            })
            .catch((err) => addToast(httpErrorToHuman(err), 'error'));
        });

        socket.on('SOCKET_OPEN', () => {
          if (!isSubscribed) return;
          getConfiguration(demoConfiguration.uuid)
            .then((cfg) => {
              if (isSubscribed && cfg.backup?.detached) {
                applyUpdatedConfig(cfg);
              }
            })
            .catch((err) => addToast(httpErrorToHuman(err), 'error'));
        });

        socket.setToken(token.token).connect(token.socket);
      } catch (err) {
        addToast(httpErrorToHuman(err), 'error');
      }
    };

    connectWebsocket();

    const fallbackTimer = setTimeout(() => {
      if (isSubscribed) {
        getConfiguration(demoConfiguration.uuid)
          .then((cfg) => {
            if (isSubscribed && cfg.backup?.detached) {
              applyUpdatedConfig(cfg);
            }
          })
          .catch((err) => addToast(httpErrorToHuman(err), 'error'));
      }
    }, 2000);

    return () => {
      isSubscribed = false;
      clearTimeout(fallbackTimer);
      if (websocketRef.current) {
        websocketRef.current.removeAllListeners();
        websocketRef.current.close();
        websocketRef.current = null;
      }
    };
  }, [
    demoConfiguration.backup?.uuid,
    demoConfiguration.backup?.detached,
    demoConfiguration.serverUuid,
    demoConfiguration.uuid,
    applyUpdatedConfig,
  ]);

  const handleTakeOrRetake = () => {
    if (demoConfiguration.backup) {
      setOpenRetakeModal(true);
    } else {
      doTakeBackup();
    }
  };

  const doTakeBackup = () => {
    setOpenRetakeModal(false);
    setTakingBackup(true);
    takeBackup(demoConfiguration.uuid)
      .then((updated) => {
        applyUpdatedConfig(updated);
        addToast(tExt('common.toast.backupTaken', {}), 'success');
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setTakingBackup(false));
  };

  const doRestoreNow = () => {
    setOpenRestoreModal(false);
    setRestoring(true);
    restoreBackup(demoConfiguration.uuid)
      .then((updated) => {
        applyUpdatedConfig(updated);
        addToast(tExt('common.toast.restoreStarted', {}), 'success');
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setRestoring(false));
  };

  const doClearBackup = () => {
    setOpenClearModal(false);
    clearBackup(demoConfiguration.uuid)
      .then((updated) => {
        applyUpdatedConfig(updated);
        addToast(tExt('common.toast.backupUnlinked', {}), 'success');
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));
  };

  const isPending = takingBackup || (!!demoConfiguration.backup && !demoConfiguration.backup.detached);
  const isReady = !!demoConfiguration.backup && demoConfiguration.backup.detached;
  const hasBackup = !!demoConfiguration.backup;

  return (
    <Stack gap='md'>
      {openLinkModal && (
        <LinkBackupModal
          demoConfiguration={demoConfiguration}
          opened={true}
          onClose={() => setOpenLinkModal(false)}
          onSuccess={applyUpdatedConfig}
        />
      )}

      <ConfirmationModal
        opened={openRestoreModal}
        onClose={() => setOpenRestoreModal(false)}
        title={tExt('pages.admin.configuration.backups.restoreConfirmTitle', {})}
        confirm={t('common.button.restore', {})}
        onConfirmed={doRestoreNow}
      >
        {tExt('pages.admin.configuration.backups.restoreConfirm', {})}
      </ConfirmationModal>

      <ConfirmationModal
        opened={openClearModal}
        onClose={() => setOpenClearModal(false)}
        title={tExt('pages.admin.configuration.backups.unlinkConfirmTitle', {})}
        confirm={tExt('common.button.unlinkBackup', {})}
        onConfirmed={doClearBackup}
      >
        {tExt('pages.admin.configuration.backups.unlinkConfirm', {})}
      </ConfirmationModal>

      <ConfirmationModal
        opened={openRetakeModal}
        onClose={() => setOpenRetakeModal(false)}
        title={tExt('pages.admin.configuration.backups.retakeConfirmTitle', {})}
        confirm={tExt('common.button.retakeBackup', {})}
        onConfirmed={doTakeBackup}
      >
        {tExt('pages.admin.configuration.backups.retakeConfirm', {})}
      </ConfirmationModal>

      <Group justify='space-between' align='center' mb='xs'>
        <Group gap='sm' align='center'>
          <Text fw={700} size='lg'>
            {tExt('pages.admin.configuration.backups.backup', {})}
          </Text>
          {hasBackup ? (
            <Badge color={isReady ? 'green' : 'yellow'} variant='light' size='sm'>
              {isReady
                ? tExt('pages.admin.configuration.backups.linkedBadge', {})
                : tExt('pages.admin.configuration.backups.pendingBadge', {})}
            </Badge>
          ) : (
            <Badge color='yellow' variant='light' size='sm'>
              {tExt('pages.admin.configuration.backups.noBackupBadge', {})}
            </Badge>
          )}
        </Group>

        <Group gap='xs'>
          <Button
            variant='light'
            size='xs'
            onClick={() => setOpenLinkModal(true)}
            leftSection={<FontAwesomeIcon icon={faLink} />}
          >
            {tExt('common.button.linkBackup', {})}
          </Button>

          <Button
            size='xs'
            onClick={handleTakeOrRetake}
            loading={takingBackup}
            disabled={isPending}
            leftSection={<FontAwesomeIcon icon={faArchive} />}
          >
            {hasBackup ? tExt('common.button.retakeBackup', {}) : tExt('common.button.takeBackup', {})}
          </Button>
        </Group>
      </Group>

      {!hasBackup && !takingBackup ? (
        <div className='p-6 bg-(--mantine-color-default) rounded-md text-center border border-(--mantine-color-default-border)'>
          <Text size='sm' c='dimmed'>
            {tExt('pages.admin.configuration.backups.noBackup', {})}
          </Text>
        </div>
      ) : (
        <Table
          columns={[
            t('common.table.columns.name', {}),
            t('common.table.columns.checksum', {}),
            t('common.table.columns.size', {}),
            t('common.table.columns.files', {}),
            tExt('pages.admin.configuration.configurations.table.lastRestored', {}),
            '',
          ]}
        >
          <TableRow>
            <TableData>
              <span className='truncate font-medium'>
                {demoConfiguration.backup?.name ||
                  demoConfiguration.backup?.uuid ||
                  tExt('pages.admin.configuration.backups.pendingBadge', {})}
              </span>
            </TableData>

            <TableData>
              {demoConfiguration.backup?.checksum ? (
                <Code>{demoConfiguration.backup.checksum}</Code>
              ) : (
                <span className='text-gray-400'>—</span>
              )}
            </TableData>

            {isPending ? (
              <TableData colSpan={2}>
                <Tooltip
                  label={`${bytesProgressString(progress?.progress || 0, progress?.total || 0)} · ${tItem('file', progress?.files || 0)}`}
                  innerClassName='w-full'
                >
                  <Progress
                    indeterminate={!progress?.total}
                    value={((progress?.progress || 0) / (progress?.total || 1)) * 100}
                  />
                </Tooltip>
              </TableData>
            ) : (
              <>
                <TableData>
                  {demoConfiguration.backup?.bytes ? (
                    bytesToString(demoConfiguration.backup.bytes)
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </TableData>

                <TableData>
                  {demoConfiguration.backup?.files !== null && demoConfiguration.backup?.files !== undefined ? (
                    demoConfiguration.backup.files
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </TableData>
              </>
            )}

            <TableData>
              {demoConfiguration.lastRestore ? (
                <FormattedTimestamp timestamp={demoConfiguration.lastRestore} />
              ) : (
                <span className='text-gray-400'>—</span>
              )}
            </TableData>

            <TableData>
              <Group gap='xs'>
                <Button
                  size='xs'
                  variant='light'
                  color='green'
                  disabled={!isReady || restoring || isPending}
                  loading={restoring}
                  onClick={() => setOpenRestoreModal(true)}
                  leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
                >
                  {t('common.button.restore', {})}
                </Button>

                <Button
                  size='xs'
                  variant='default'
                  color='red'
                  disabled={isPending}
                  onClick={() => setOpenClearModal(true)}
                  leftSection={<FontAwesomeIcon icon={faTrash} />}
                >
                  {tExt('common.button.unlinkBackup', {})}
                </Button>
              </Group>
            </TableData>
          </TableRow>
        </Table>
      )}
    </Stack>
  );
}
