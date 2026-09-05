import { registerRootComponent } from 'expo';

// Must run before any screen/component module can construct
// Intl.NumberFormat -- see the file for why.
import './src/utils/intlSafety';

import App from './EnhancedApp'; // eslint-disable-line import/no-named-as-default

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
