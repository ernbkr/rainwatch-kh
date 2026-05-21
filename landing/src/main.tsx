import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import './index.css';
import { App } from './App';
import { theme } from './theme';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found.');
}

createRoot(container).render(
  <MantineProvider theme={theme} forceColorScheme="dark">
    <App />
  </MantineProvider>
);
