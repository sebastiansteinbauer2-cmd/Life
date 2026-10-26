import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/tiny5/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupUpdates } from './app/updates';
import './styles/global.css';

setupUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
