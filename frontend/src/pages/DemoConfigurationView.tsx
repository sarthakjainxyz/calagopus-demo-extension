import { faArrowLeft, faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import getConfiguration from '../api/configurations/getConfiguration.ts';
import { useExtTranslations } from '../translations.ts';
import DemoConfigurationCreateOrUpdate from './DemoConfigurationCreateOrUpdate.tsx';

export default function DemoConfigurationView() {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const params = useParams<'id'>();
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => ['extensions', 'xyz.stellarstudios.demo', 'demoConfigurations', { uuid: params.id }] as const,
    [params.id],
  );

  const resource = useResource({
    queryKey,
    queryFn: () => getConfiguration(params.id!),
  });

  const handleUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return (
    <ResourceView resource={resource}>
      {(demoConfiguration) => (
        <AdminContentContainer title={demoConfiguration.name}>
          <Link
            to='/admin/extensions/xyz.stellarstudios.demo'
            className='inline-block mb-4 text-sm text-(--mantine-color-anchor) hover:underline'
          >
            <FontAwesomeIcon icon={faArrowLeft} /> {tExt('common.button.back', {})}
          </Link>

          <SubNavigation
            baseUrl={`/admin/extensions/xyz.stellarstudios.demo/${params.id}`}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: (
                  <DemoConfigurationCreateOrUpdate
                    contextDemoConfiguration={demoConfiguration}
                    onUpdated={handleUpdated}
                  />
                ),
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
