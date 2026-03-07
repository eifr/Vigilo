# Troubleshooting Steps

If you are still experiencing issues:

1.  **Clear Browser Cache/Storage**: The application caches settings in `localStorage`. Since we changed the default configuration structure, old settings might be causing conflicts. Open your browser's DevTools -> Application -> Storage -> Local Storage and clear it.
2.  **Hard Refresh**: Press `Ctrl+Shift+R` or `Cmd+Shift+R` to force a reload of the worker scripts.

The `yolo-engine` has been updated to force `zeroPad` (640x640) input sizing, which matches the ONNX model's requirement.
