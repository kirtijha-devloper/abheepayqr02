import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global fix for number inputs: disable scroll to change value
document.addEventListener("wheel", () => {
  if (document.activeElement.type === "number") {
    document.activeElement.blur();
  }
});

// Deployment fix: Reload page if a dynamic import fails (old build files gone)
window.addEventListener('vite:preloadError', (event) => {
  console.log('Vite preload error detected, reloading page...', event);
  window.location.reload();
});

// Generic catch for dynamic import failures
window.addEventListener('error', (event) => {
  if (event.message?.includes('Failed to fetch dynamically') || 
      event.message?.includes('Importing a module script failed')) {
    console.log('Dynamic import error caught, reloading...', event.message);
    window.location.reload();
  }
}, true);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
