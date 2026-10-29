import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AdminDemoConfigurationListItem } from '../lib/schema.ts';
import { useExtTranslations } from '../translations.ts';

export default function DemoConfigurationRow({
  demoConfiguration,
}: {
  demoConfiguration: AdminDemoConfigurationListItem;
}) {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();

  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/extensions/xyz.stellarstudios.demo/${demoConfiguration.uuid}`}>
          <Code>{demoConfiguration.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>
        <span className='font-medium'>{demoConfiguration.name}</span>
      </TableData>

      <TableData>
        <TableLink to={`/admin/servers/${demoConfiguration.serverUuid}`}>
          {demoConfiguration.serverName || <Code>{demoConfiguration.serverUuid.slice(0, 8)}</Code>}
        </TableLink>
      </TableData>

      <TableData>
        <span className='font-medium'>{demoConfiguration.permissions.length}</span>
      </TableData>

      <TableData>
        {demoConfiguration.backupEnabled ? (
          <div className='flex items-center gap-2'>
            <span>{demoConfiguration.restoreInterval ?? 3600}s</span>
            {!demoConfiguration.hasBackup && (
              <Badge color='red' variant='light' size='xs'>
                {tExt('pages.admin.configuration.configurations.badge.missingBackup', {})}
              </Badge>
            )}
          </div>
        ) : (
          <div className='flex items-center gap-2'>
            <span className='text-gray-400'>{t('common.badge.disabled', {})}</span>
            {!demoConfiguration.hasBackup && (
              <Badge color='gray' variant='light' size='xs'>
                {tExt('pages.admin.configuration.configurations.badge.noBackup', {})}
              </Badge>
            )}
          </div>
        )}
      </TableData>

      <TableData>
        {demoConfiguration.lastRestore ? (
          <FormattedTimestamp timestamp={demoConfiguration.lastRestore} />
        ) : (
          <span className='text-gray-400'>{t('common.never', {})}</span>
        )}
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={demoConfiguration.created} />
      </TableData>
    </TableRow>
  );
}
