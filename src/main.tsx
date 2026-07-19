import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// StrictMode double-mounts effects in dev, which tears down WebSocket mid-handshake.
// Disabled so the ESP8266 controller keeps a stable single connection.
createRoot(document.getElementById('root')!).render(<App />);
