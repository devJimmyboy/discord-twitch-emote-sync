import './index.css'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { createRoot } from 'react-dom/client'
import App from './App'
const root = createRoot(document.getElementById('root')!)

root.render(
  <MantineProvider
    withGlobalStyles
    withNormalizeCSS
    theme={{
      colorScheme: 'dark',
    }}>
    <ModalsProvider>
      <App />
    </ModalsProvider>
  </MantineProvider>
)
