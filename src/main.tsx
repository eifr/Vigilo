import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'

render(<App />, document.getElementById('app')!)

if ('serviceWorker' in navigator) {
  import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/sw.js');

    wb.addEventListener('waiting', () => {
      if (confirm('A new version is available. Reload to update?')) {
        wb.messageSkipWaiting();
        window.location.reload();
      }
    });

    wb.register();
  });
}
