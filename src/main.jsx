import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import App from './App.jsx';
import './index.css';

// Feels like an app: iOS Safari ignores user-scalable=no, so pinch zoom is
// stopped here (its gesture events only exist on iOS).
document.addEventListener('gesturestart', (e) => e.preventDefault());

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
