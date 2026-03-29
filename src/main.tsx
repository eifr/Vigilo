import { render } from "preact";
import "./index.css";
import { App } from "./app.tsx";
import { RootLayout } from "./root.tsx";

render(
  <RootLayout>
    <App />
  </RootLayout>,
  document.getElementById("app")!,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const registerServiceWorker = async () => {
    try {
      const { Workbox } = await import("workbox-window");
      const wb = new Workbox("/sw.js", { scope: "/" });

      wb.addEventListener("waiting", () => {
        if (confirm("A new version is available. Reload to update?")) {
          wb.messageSkipWaiting();
          window.location.reload();
        }
      });

      wb.addEventListener("installed", (event: any) => {
        if (!event.isUpdate) {
          console.log("Service Worker installed for the first time");
        }
      });

      await wb.register();
      console.log("Service Worker registered successfully");
    } catch (error) {
      console.warn("Service Worker registration skipped:", error);
    }
  };

  registerServiceWorker();
}
