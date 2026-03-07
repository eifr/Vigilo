export interface CameraTask {
  id: string;
  type: "add-camera" | "remove-camera" | "capture-frame";
  data?: any;
  resolve?: (value: any) => void;
  reject?: (error: Error) => void;
}

import { getUserMediaWithTimeout } from "./utils";

export class CameraQueue {
  private static instance: CameraQueue | null = null;
  private queue: CameraTask[] = [];
  private isProcessing: boolean = false;
  private processingDelay: number = 100; // ms between operations

  private constructor() {}

  static getInstance(): CameraQueue {
    if (!CameraQueue.instance) {
      CameraQueue.instance = new CameraQueue();
    }
    return CameraQueue.instance;
  }

  /**
   * Add a task to the queue
   */
  async addTask(task: Omit<CameraTask, "id">): Promise<any> {
    return new Promise((resolve, reject) => {
      const fullTask: CameraTask = {
        ...task,
        id: this.generateTaskId(),
        resolve,
        reject,
      };

      this.queue.push(fullTask);
      this.processQueue();
    });
  }

  /**
   * Clear all pending tasks
   */
  clearQueue(): void {
    // Reject all pending tasks
    this.queue.forEach((task) => {
      if (task.reject) {
        task.reject(new Error("Queue cleared"));
      }
    });
    this.queue = [];
  }

  /**
   * Get current queue status
   */
  getStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      try {
        const result = await this.executeTask(task);
        if (task.resolve) {
          task.resolve(result);
        }
      } catch (error) {
        console.error(`Camera task failed:`, task, error);
        if (task.reject) {
          task.reject(error as Error);
        }
      }

      // Small delay between operations to prevent overwhelming the browser
      if (this.queue.length > 0) {
        await this.delay(this.processingDelay);
      }
    }

    this.isProcessing = false;
  }

  private async executeTask(task: CameraTask): Promise<any> {
    switch (task.type) {
      case "add-camera":
        return this.executeAddCamera(task.data);

      case "remove-camera":
        return this.executeRemoveCamera(task.data);

      case "capture-frame":
        return this.executeCaptureFrame(task.data);

      default:
        throw new Error(`Unknown task type: ${(task as any).type}`);
    }
  }

  private async executeAddCamera(data: {
    deviceId: string;
    callback?: (stream: MediaStream) => void;
  }): Promise<MediaStream> {
    if (import.meta.env.DEV) {
      console.log(`Adding camera with device ID: ${data.deviceId}`);
    }

    try {
      const stream = await getUserMediaWithTimeout(
        {
          video: {
            deviceId: { exact: data.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        5000,
      );

      const trackId = this.generateTaskId();
      this.trackStream(trackId, stream);

      if (data.callback) {
        data.callback(stream);
      }

      if (import.meta.env.DEV) {
        console.log(`Camera added successfully with track ID: ${trackId}`);
      }
      return stream;
    } catch (error) {
      console.error("Failed to add camera:", error);
      throw error;
    }
  }

  private async executeRemoveCamera(data: {
    deviceId: string;
    stream?: MediaStream;
  }): Promise<void> {
    if (import.meta.env.DEV) {
      console.log(`Removing camera with device ID: ${data.deviceId}`);
    }

    try {
      if (data.stream) {
        data.stream.getTracks().forEach((track) => {
          track.stop();
          if (import.meta.env.DEV) {
            console.log(`Stopped track: ${track.label || track.id}`);
          }
        });
      }

      this.stopStreamByDeviceId(data.deviceId);

      if (import.meta.env.DEV) {
        console.log(`Camera removed successfully: ${data.deviceId}`);
      }
    } catch (error) {
      console.error("Failed to remove camera:", error);
      throw error;
    }
  }

  private async executeCaptureFrame(data: {
    video: HTMLVideoElement;
    quality?: number;
  }): Promise<string> {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      canvas.width = data.video.videoWidth;
      canvas.height = data.video.videoHeight;
      ctx.drawImage(data.video, 0, 0);

      const quality = data.quality || 0.8;
      return canvas.toDataURL("image/jpeg", quality);
    } catch (error) {
      console.error("Failed to capture frame:", error);
      throw error;
    }
  }

  // Stream tracking for cleanup
  private activeStreams: Map<string, { stream: MediaStream; deviceId: string; timestamp: number }> =
    new Map();

  private trackStream(trackId: string, stream: MediaStream): void {
    // Try to extract deviceId from stream tracks
    let deviceId = "";
    try {
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      deviceId = settings.deviceId || "";
    } catch (e) {
      // Ignore errors
    }

    this.activeStreams.set(trackId, {
      stream,
      deviceId,
      timestamp: Date.now(),
    });

    // Cleanup old streams (older than 1 hour)
    this.cleanupOldStreams();
  }

  private stopStreamByDeviceId(deviceId: string): void {
    for (const [currentTrackId, streamInfo] of this.activeStreams.entries()) {
      if (streamInfo.deviceId === deviceId) {
        streamInfo.stream.getTracks().forEach((track) => track.stop());
        this.activeStreams.delete(currentTrackId);
        if (import.meta.env.DEV) {
          console.log(`Stopped stream by deviceId: ${deviceId}, trackId: ${currentTrackId}`);
        }
      }
    }
  }

  private cleanupOldStreams(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [currentTrackId, streamInfo] of this.activeStreams.entries()) {
      if (now - streamInfo.timestamp > maxAge) {
        streamInfo.stream.getTracks().forEach((track) => track.stop());
        this.activeStreams.delete(currentTrackId);
        if (import.meta.env.DEV) {
          console.log(`Cleaned up old stream: ${currentTrackId}`);
        }
      }
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get information about active streams for debugging
   */
  getActiveStreamsInfo(): {
    count: number;
    streams: Array<{ trackId: string; deviceId: string; age: number }>;
  } {
    const now = Date.now();
    const streams = Array.from(this.activeStreams.entries()).map(([trackId, info]) => ({
      trackId,
      deviceId: info.deviceId,
      age: now - info.timestamp,
    }));

    return {
      count: this.activeStreams.size,
      streams,
    };
  }

  /**
   * Cleanup all active streams (for shutdown)
   */
  cleanup(): void {
    if (import.meta.env.DEV) {
      console.log(`Cleaning up ${this.activeStreams.size} active camera streams`);
    }

    for (const [, streamInfo] of this.activeStreams.entries()) {
      streamInfo.stream.getTracks().forEach((track) => track.stop());
    }

    this.activeStreams.clear();
    this.clearQueue();
    this.isProcessing = false;
  }
}

// Export singleton instance
export const cameraQueue = CameraQueue.getInstance();
