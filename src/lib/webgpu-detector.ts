export interface WebGPUInfo {
  isSupported: boolean;
  isAvailable: boolean;
  adapterInfo?: {
    name: string;
    vendor: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
  features: string[];
  limits: Record<string, number>;
  fallbackReason?: string;
}

export class WebGPUDetector {
  private static instance: WebGPUDetector;
  private info: WebGPUInfo | null = null;
  private checkPromise: Promise<WebGPUInfo> | null = null;

  static getInstance(): WebGPUDetector {
    if (!WebGPUDetector.instance) {
      WebGPUDetector.instance = new WebGPUDetector();
    }
    return WebGPUDetector.instance;
  }

  async checkWebGPUSupport(): Promise<WebGPUInfo> {
    // Return cached result if available
    if (this.info) {
      return this.info;
    }

    // Return ongoing check if in progress
    if (this.checkPromise) {
      return this.checkPromise;
    }

    this.checkPromise = this.performWebGPUCheck();
    this.info = await this.checkPromise;
    return this.info;
  }

  private async performWebGPUCheck(): Promise<WebGPUInfo> {
    const info: WebGPUInfo = {
      isSupported: false,
      isAvailable: false,
      features: [],
      limits: {},
    };

    try {
      // Check if navigator.gpu exists
      const nav = navigator as any;
      if (!nav.gpu) {
        info.fallbackReason = "WebGPU API not available in this browser";
        return info;
      }

      info.isSupported = true;

      // Request adapter
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) {
        info.fallbackReason = "No WebGPU adapter available";
        return info;
      }

      info.isAvailable = true;

      // Get adapter info
      if (adapter.info) {
        info.adapterInfo = {
          name: adapter.info.name || "Unknown",
          vendor: adapter.info.vendor || "Unknown",
          architecture: adapter.info.architecture,
          device: adapter.info.device,
          description: adapter.info.description,
        };
      }

      // Get features
      info.features = Array.from(adapter.features);

      // Get limits
      const limits = await adapter.limits;
      info.limits = {
        maxTextureDimension1D: limits.maxTextureDimension1D,
        maxTextureDimension2D: limits.maxTextureDimension2D,
        maxTextureDimension3D: limits.maxTextureDimension3D,
        maxTextureArrayLayers: limits.maxTextureArrayLayers,
        maxBindGroups: limits.maxBindGroups,
        maxDynamicUniformBuffersPerPipelineLayout: limits.maxDynamicUniformBuffersPerPipelineLayout,
        maxDynamicStorageBuffersPerPipelineLayout: limits.maxDynamicStorageBuffersPerPipelineLayout,
        maxSampledTexturesPerShaderStage: limits.maxSampledTexturesPerShaderStage,
        maxSamplersPerShaderStage: limits.maxSamplersPerShaderStage,
        maxStorageBuffersPerShaderStage: limits.maxStorageBuffersPerShaderStage,
        maxStorageTexturesPerShaderStage: limits.maxStorageTexturesPerShaderStage,
        maxUniformBuffersPerShaderStage: limits.maxUniformBuffersPerShaderStage,
        maxUniformBufferBindingSize: limits.maxUniformBufferBindingSize,
        maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
        minUniformBufferOffsetAlignment: limits.minUniformBufferOffsetAlignment,
        minStorageBufferOffsetAlignment: limits.minStorageBufferOffsetAlignment,
        maxVertexBuffers: limits.maxVertexBuffers,
        maxVertexAttributes: limits.maxVertexAttributes,
        maxVertexBufferArrayStride: limits.maxVertexBufferArrayStride,
        maxInterStageShaderComponents: limits.maxInterStageShaderComponents,
        maxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize,
        maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
        maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: limits.maxComputeWorkgroupSizeY,
        maxComputeWorkgroupSizeZ: limits.maxComputeWorkgroupSizeZ,
        maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
      };

      // Try to request a device to ensure everything works
      try {
        const device = await adapter.requestDevice();
        device.destroy();
      } catch {
        info.fallbackReason = "Failed to create WebGPU device";
        info.isAvailable = false;
        return info;
      }
    } catch (error) {
      info.fallbackReason = `WebGPU initialization failed: ${error}`;
      console.error("WebGPU check failed:", error);
    }

    return info;
  }

  // Check specific features for YOLO inference
  isYOLOCompatible(info?: WebGPUInfo): boolean {
    const gpuInfo = info || this.info;
    if (!gpuInfo?.isAvailable) return false;

    // Check for required features
    const requiredFeatures = ["timestamp-query", "texture-compression-bc"];

    const hasRequiredFeatures = requiredFeatures.some((feature) =>
      gpuInfo.features.includes(feature),
    );

    // Check texture limits
    const hasAdequateTextureLimits = gpuInfo.limits.maxTextureDimension2D >= 1024;

    return hasRequiredFeatures && hasAdequateTextureLimits;
  }

  // Get performance estimate based on adapter info
  getPerformanceEstimate(info?: WebGPUInfo): "low" | "medium" | "high" {
    const gpuInfo = info || this.info;
    if (!gpuInfo?.isAvailable) return "low";

    const vendor = gpuInfo.adapterInfo?.vendor?.toLowerCase() || "";
    const name = gpuInfo.adapterInfo?.name?.toLowerCase() || "";

    // High-end GPUs
    if (
      vendor.includes("nvidia") &&
      (name.includes("rtx") || name.includes("gtx") || name.includes("geforce"))
    ) {
      return "high";
    }

    if (vendor.includes("amd") && (name.includes("radeon") || name.includes("rx"))) {
      return "high";
    }

    if (vendor.includes("intel") && (name.includes("arc") || name.includes("iris"))) {
      return "medium";
    }

    // Apple Silicon
    if (
      vendor.includes("apple") &&
      (name.includes("m1") || name.includes("m2") || name.includes("m3"))
    ) {
      return "high";
    }

    // Integrated graphics
    if (
      name.includes("intel") &&
      (name.includes("hd graphics") || name.includes("uhd graphics") || name.includes("iris"))
    ) {
      return "medium";
    }

    return "low";
  }

  // Get browser compatibility info
  getBrowserCompatibility(): {
    browser: string;
    version: string;
    webGPUSupported: boolean;
    recommended: boolean;
    notes: string[];
  } {
    const userAgent = navigator.userAgent;
    let browser = "Unknown";
    let version = "Unknown";
    let webGPUSupported = false;
    let recommended = false;
    const notes: string[] = [];

    // Detect browser
    if (userAgent.includes("Chrome")) {
      browser = "Chrome";
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : "Unknown";
      webGPUSupported = parseInt(version) >= 113;
      recommended = webGPUSupported;
      if (!webGPUSupported) {
        notes.push("Chrome 113+ required for WebGPU support");
      }
    } else if (userAgent.includes("Firefox")) {
      browser = "Firefox";
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? match[1] : "Unknown";
      webGPUSupported = parseInt(version) >= 113;
      recommended = webGPUSupported && parseInt(version) >= 115;
      if (webGPUSupported && parseInt(version) < 115) {
        notes.push("Firefox 115+ recommended for better WebGPU performance");
      }
    } else if (userAgent.includes("Safari")) {
      browser = "Safari";
      const match = userAgent.match(/Version\/(\d+)/);
      version = match ? match[1] : "Unknown";
      webGPUSupported = parseInt(version) >= 16.4;
      recommended = webGPUSupported && parseInt(version) >= 17;
      if (!webGPUSupported) {
        notes.push("Safari 16.4+ required for WebGPU support");
      } else if (parseInt(version) < 17) {
        notes.push("Safari 17+ recommended for better WebGPU performance");
      }
    } else if (userAgent.includes("Edge")) {
      browser = "Edge";
      const match = userAgent.match(/Edge\/(\d+)/);
      version = match ? match[1] : "Unknown";
      webGPUSupported = parseInt(version) >= 113;
      recommended = webGPUSupported;
      if (!webGPUSupported) {
        notes.push("Edge 113+ required for WebGPU support");
      }
    } else {
      notes.push("WebGPU may not be supported in this browser");
    }

    return {
      browser,
      version,
      webGPUSupported,
      recommended,
      notes,
    };
  }
}

// Export singleton instance
export const webGPUDetector = WebGPUDetector.getInstance();
