import { faFlask } from '@fortawesome/free-solid-svg-icons';
import { Extension, ExtensionContext } from 'shared';
import LoginDemoAlert from './components/LoginDemoAlert.tsx';
import ConfigurationPage from './pages/ConfigurationPage.tsx';
import DemoConfigurationCreateOrUpdate from './pages/DemoConfigurationCreateOrUpdate.tsx';
import DemoConfigurationView from './pages/DemoConfigurationView.tsx';

class DemoConfigurationsExtension extends Extension {
  public cardConfigurationPage = ConfigurationPage;
  public cardIcon = faFlask;

  public initialize(ctx: ExtensionContext): void {
    ctx.extensionRegistry.enterRoutes((routes) => {
      routes.addAdminRoute({
        name: undefined,
        path: '/extensions/xyz.stellarstudios.demo/new',
        element: DemoConfigurationCreateOrUpdate,
      });
      routes.addAdminRoute({
        name: undefined,
        path: '/extensions/xyz.stellarstudios.demo/:id/*',
        element: DemoConfigurationView,
      });
    });

    ctx.extensionRegistry.enterPages((pages) => {
      pages.enterAuth((auth) => {
        auth.enterLogin((login) => {
          login.enterContainer((container) => {
            container.prependContentComponent(LoginDemoAlert);
          });
        });
        auth.enterRegister((register) => {
          register.enterContainer((container) => {
            container.prependContentComponent(LoginDemoAlert);
          });
        });
      });
    });
  }
}

export default new DemoConfigurationsExtension();
