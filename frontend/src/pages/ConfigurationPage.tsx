import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
import { faBell, faInfoCircle, faPlus, faSave, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Table from '@/elements/data-display/Table.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import LocalizedTextArea from '@/elements/input/LocalizedTextArea.tsx';
import LocalizedTextInput from '@/elements/input/LocalizedTextInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { announcementTypeLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import getConfigurations from '../api/configurations/getConfigurations.ts';
import getProductData, { ProductData } from '../api/settings/getProductData.ts';
import getSettings from '../api/settings/getSettings.ts';
import updateSettings from '../api/settings/updateSettings.ts';
import { AdminDemoConfigurationListItem } from '../lib/schema.ts';
import { useExtTranslations } from '../translations.ts';
import DemoConfigurationRow from './DemoConfigurationRow.tsx';

export default function ConfigurationPage() {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const languages = useGlobalStore((state) => state.languages);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertStyle, setAlertStyle] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [alertTitle, setAlertTitle] = useState<string | null>('Demo Access');
  const [alertTitleTranslations, setAlertTitleTranslations] = useState<Record<string, string>>({});
  const [alertMessage, setAlertMessage] = useState<string | null>(
    'Please create an account to demo the panel. You will automatically receive server access.',
  );
  const [alertMessageTranslations, setAlertMessageTranslations] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    getProductData()
      .then(setProduct)
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));

    getSettings()
      .then((data) => {
        setAlertEnabled(data.alert_enabled);
        setAlertStyle(data.alert_style);
        setAlertTitle(data.alert_title);
        setAlertTitleTranslations(data.alert_title_translations ?? {});
        setAlertMessage(data.alert_message);
        setAlertMessageTranslations(data.alert_message_translations ?? {});
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));
  }, []);

  const onSaveAlertSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings({
        alert_enabled: alertEnabled,
        alert_style: alertStyle,
        alert_title: alertTitle,
        alert_title_translations: alertTitleTranslations,
        alert_message: alertMessage,
        alert_message_translations: alertMessageTranslations,
      });
      addToast(tExt('pages.admin.configuration.alertSettings.saved', {}), 'success');
    } catch (err) {
      addToast(httpErrorToHuman(err), 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const {
    data: demoConfigurations,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable<Pagination<AdminDemoConfigurationListItem>>({
    queryKey: ['extensions', 'xyz.stellarstudios.demo', 'demoConfigurations'],
    fetcher: (page, search, perPage) => getConfigurations(page, search, perPage),
  });

  const discordUrl = product?.discord || 'https://discord.gg/sQjuWcDxBY';
  const githubUrl =
    (product?.providers && product.providers['GITHUB']?.link) ||
    'https://github.com/sarthakjainxyz/calagopus-demo-extension';

  return (
    <Stack gap='lg'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 items-start'>
        <TitleCard
          title={tExt('pages.admin.configuration.information.title', {})}
          icon={<FontAwesomeIcon icon={faInfoCircle} />}
          className='w-full'
        >
          <Stack gap='sm'>
            <p>{tExt('pages.admin.configuration.information.description', {})}</p>

            <p>
              {tExt('pages.admin.configuration.information.version', {
                current: '1.2.0',
                latest: product?.version ?? 'UNKNOWN',
              })}
            </p>

            <Group>
              <a href={discordUrl} target='_blank' rel='noopener noreferrer'>
                <Button leftSection={<FontAwesomeIcon icon={faDiscord} />}>
                  {tExt('pages.admin.configuration.information.button.joinDiscord', {})}
                </Button>
              </a>
              <a href={githubUrl} target='_blank' rel='noopener noreferrer'>
                <Button leftSection={<FontAwesomeIcon icon={faGithub} />}>
                  {tExt('pages.admin.configuration.information.button.github', {})}
                </Button>
              </a>
            </Group>
          </Stack>
        </TitleCard>

        <TitleCard
          title={tExt('pages.admin.configuration.alertSettings.title', {})}
          icon={<FontAwesomeIcon icon={faBell} />}
          className='w-full'
        >
          <Stack gap='sm'>
            <Switch
              label={tExt('pages.admin.configuration.alertSettings.enabled', {})}
              checked={alertEnabled}
              onChange={(e) => setAlertEnabled(e.currentTarget.checked)}
            />

            <Select
              label={t('common.form.type', {})}
              data={mappingToSelectData(announcementTypeLabelMapping)}
              value={alertStyle}
              onChange={(val) => setAlertStyle((val as 'info' | 'success' | 'warning' | 'error') ?? 'info')}
            />

            <LocalizedTextInput
              languages={languages}
              value={alertTitle}
              setValue={setAlertTitle}
              valueTranslations={alertTitleTranslations}
              setValueTranslations={setAlertTitleTranslations}
              label={t('common.form.title', {})}
              placeholder={t('common.form.title', {})}
            />

            <LocalizedTextArea
              languages={languages}
              value={alertMessage}
              setValue={setAlertMessage}
              valueTranslations={alertMessageTranslations}
              setValueTranslations={setAlertMessageTranslations}
              label={t('common.form.content', {})}
              placeholder={t('common.form.content', {})}
              rows={3}
            />

            <Button
              type='submit'
              className='w-fit!'
              loading={savingSettings}
              onClick={onSaveAlertSettings}
              leftSection={<FontAwesomeIcon icon={faSave} />}
            >
              {t('common.button.save', {})}
            </Button>
          </Stack>
        </TitleCard>
      </div>

      <div>
        <Group justify='space-between' mb='md'>
          <Title order={1}>{tExt('pages.admin.configuration.configurations.title', {})}</Title>
          <Group>
            <TextInput
              placeholder={t('common.input.search', {})}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              leftSection={<FontAwesomeIcon icon={faSearch} />}
              w={250}
            />
            <Button
              onClick={() => navigate('/admin/extensions/xyz.stellarstudios.demo/new')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </Group>
        </Group>

        <Table
          columns={[
            t('common.table.columns.id', {}),
            t('common.table.columns.name', {}),
            t('common.table.columns.server', {}),
            tExt('pages.admin.configuration.configurations.table.permissions', {}),
            tExt('pages.admin.configuration.configurations.table.restoreInterval', {}),
            tExt('pages.admin.configuration.configurations.table.lastRestored', {}),
            t('common.table.columns.created', {}),
          ]}
          loading={loading}
          error={error}
          pagination={demoConfigurations}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
        >
          {demoConfigurations?.data.map((dc) => (
            <DemoConfigurationRow key={dc.uuid} demoConfiguration={dc} />
          ))}
        </Table>
      </div>
    </Stack>
  );
}
