import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VoultProvider } from '@voult/react';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <VoultProvider apiBase="/api/auth">
      <App />
    </VoultProvider>
  </StrictMode>
);
