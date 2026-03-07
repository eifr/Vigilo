import * as MP4Box from "mp4box";

// Define the configuration structure expected by your decoder
export interface VideoConfig {
  codec: string;
  bitrate: number;
  codedHeight: number;
  codedWidth: number;
  nb_frames: number;
  description: Uint8Array;
}

/**
 * Demuxes the first video track of an MP4 file using MP4Box
 */
export class MP4Demuxer {
  private file: any; // MP4Box file instance

  constructor(
    file: File | Blob,
    onConfig: (config: VideoConfig) => void,
    onChunk: (chunk: EncodedVideoChunk) => void,
  ) {
    this.file = MP4Box.createFile();

    this.file.onError = (error: string) => {
      console.error("MP4Box error:", error);
    };

    // Triggered when demuxer has parsed the moov box and is ready
    this.file.onReady = (info: any) => {
      const track = info.videoTracks[0]; // get the first video track

      const config: VideoConfig = {
        codec: track.codec,
        bitrate: track.bitrate,
        codedHeight: track.video.height,
        codedWidth: track.video.width,
        nb_frames: track.nb_samples,
        description: this.getDescription(track),
      };

      onConfig(config); // send the config to the decoder
      this.file.setExtractionOptions(track.id); // set up track for sample extraction
      this.file.start(); // start extracting samples
    };

    // Triggered when samples (frames) are extracted
    this.file.onSamples = (_trackId: number, _ref: any, samples: any[]) => {
      for (const sample of samples) {
        // Convert MP4 sample to WebCodecs EncodedVideoChunk
        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (1e6 * sample.cts) / sample.timescale,
          duration: (1e6 * sample.duration) / sample.timescale,
          data: sample.data,
        });
        onChunk(chunk);
      }
    };

    this.readFile(file); // start reading the file
  }

  /**
   * Gets the codec-specific configuration data (description) needed to initialize the VideoDecoder.
   */
  private getDescription(track: any): Uint8Array {
    const trak = this.file.getTrackById(track.id);

    for (const entry of trak.mdia.minf.stbl.stsd.entries) {
      // Check for supported codec configuration boxes
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box) {
        const stream = new MP4Box.DataStream(undefined, 0, (MP4Box.DataStream as any).BIG_ENDIAN);
        box.write(stream);
        // The first 8 bytes are the box header (size and type), so we slice them off
        return new Uint8Array(stream.buffer, 8);
      }
    }
    throw new Error("avcC, hvcC, vpcC, or av1C box not found");
  }

  /**
   * Reads the Blob/File and feeds it into MP4Box.
   */
  private readFile(file: File | Blob): void {
    const reader = new FileReader();

    reader.onload = () => {
      if (!reader.result) return;

      // MP4Box requires a custom 'fileStart' property on the ArrayBuffer
      const buffer = reader.result as ArrayBuffer & { fileStart: number };
      buffer.fileStart = 0;

      this.file.appendBuffer(buffer); // add to MP4Box buffer for analysis
      this.file.flush();
    };

    reader.readAsArrayBuffer(file);
  }
}
