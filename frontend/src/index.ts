import { Extension, ExtensionContext } from 'shared';
import ConfigurationPage from './ConfigurationPage.tsx';

class DemoExtension extends Extension {
  public cardConfigurationPage: React.FC | null = ConfigurationPage;
  public cardComponent: React.FC | null = null;

  public initialize(_ctx: ExtensionContext): void {
    // Ignore
  }
}

export default new DemoExtension();
