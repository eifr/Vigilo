// Quick test script to verify the YOLO backend implementation
import { webGPUDetector } from "../src/lib/webgpu-detector.js";
import { HybridDetector } from "../src/components/HybridDetector.tsx";

async function testImplementation() {
  console.log("🧪 Testing YOLOv26 + WebGPU Implementation...\n");

  // Test WebGPU detection
  console.log("1. Testing WebGPU capability detection...");
  const gpuInfo = await webGPUDetector.checkWebGPUSupport();
  console.log("   WebGPU Supported:", gpuInfo.isSupported);
  console.log("   WebGPU Available:", gpuInfo.isAvailable);
  console.log("   Adapter:", gpuInfo.adapterInfo?.name || "None");
  console.log("   Performance:", webGPUDetector.getPerformanceEstimate(gpuInfo));

  // Test browser compatibility
  console.log("\n2. Testing browser compatibility...");
  const browserInfo = webGPUDetector.getBrowserCompatibility();
  console.log("   Browser:", browserInfo.browser, browserInfo.version);
  console.log("   WebGPU Supported:", browserInfo.webGPUSupported);
  console.log("   Recommended:", browserInfo.recommended);

  // Test YOLO compatibility
  console.log("\n3. Testing YOLO compatibility...");
  const yoloCompatible = webGPUDetector.isYOLOCompatible(gpuInfo);
  console.log("   YOLO Compatible:", yoloCompatible);

  console.log("\n✅ Implementation test complete!");
  console.log("\n📝 Next steps:");
  console.log("   1. Start the dev server: bun run dev");
  console.log("   2. Open the app and go to Motion Sensitivity settings");
  console.log('   3. Select "YOLOv26 + WebGPU" backend');
  console.log("   4. Add a camera to test object detection");
}

testImplementation().catch(console.error);
