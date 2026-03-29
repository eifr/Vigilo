import { useCallback, useRef, useState } from "preact/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useDetectionBackend } from "../hooks/useDetectionBackend";
import { useInferenceWorker } from "./Feed/useInferenceWorker";
import { renderOverlay } from "@/utils/render-overlay";
import { Loader2, Upload, Image as ImageIcon } from "lucide-react";
import classes from "../utils/yolo_classes.json";

interface InferenceTestProps {}

export const InferenceTest = ({}: InferenceTestProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inferenceTime, setInferenceTime] = useState<string | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { yoloConfig } = useDetectionBackend();
  
  const modelConfigRef = useRef({
    inputShape: [1, 3, 640, 640],
    overlaySize: [640, 640],
    iouThreshold: yoloConfig.iouThreshold,
    scoreThreshold: yoloConfig.confidenceThreshold,
    backend: yoloConfig.backend || "webgpu",
    model: "yolo11n",
    modelPath: "",
    task: "detect",
    imgszType: yoloConfig.imgszType || "dynamic",
    classes: classes,
  });
  
  const handleModelLoaded = useCallback(() => {
    setIsModelLoaded(true);
    setIsLoadingModel(false);
    setError(null);
  }, []);
  
  const handleInferenceResult = useCallback((data: any) => {
    setIsProcessing(false);
    setInferenceTime(data.inferenceTime);
    setDetectedObjects(data.results || []);
    
    // Draw overlay on canvas
    if (canvasRef.current && data.results) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        renderOverlay(data.results, ctx, modelConfigRef.current.classes);
      }
    }
  }, []);
  
  const { postMessage: postInferenceMessage } = useInferenceWorker({
    onModelLoaded: handleModelLoaded,
    onResult: handleInferenceResult,
  });
  
  const loadModel = useCallback(async () => {
    if (isModelLoaded || isLoadingModel) return;
    
    setIsLoadingModel(true);
    setError(null);
    
    const modelPath = `${window.location.href}models/${modelConfigRef.current.model}-${modelConfigRef.current.task}.onnx`;
    modelConfigRef.current.modelPath = modelPath;
    modelConfigRef.current.backend = yoloConfig.backend || "webgpu";
    modelConfigRef.current.scoreThreshold = yoloConfig.confidenceThreshold || 0.45;
    modelConfigRef.current.iouThreshold = yoloConfig.iouThreshold || 0.45;
    modelConfigRef.current.imgszType = yoloConfig.imgszType || "dynamic";
    
    postInferenceMessage(
      {
        type: "LOAD_MODEL",
        config: modelConfigRef.current,
      },
      [],
    );
  }, [postInferenceMessage, yoloConfig, isModelLoaded, isLoadingModel]);
  
  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        setSelectedImage(result);
        setDetectedObjects([]);
        setInferenceTime(null);
        setError(null);
        
        // Load model if not loaded
        if (!isModelLoaded && !isLoadingModel) {
          loadModel();
        }
      }
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsDataURL(file);
  }, [isModelLoaded, isLoadingModel, loadModel]);
  
  const handleFileChange = useCallback((e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);
  
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer?.files[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);
  
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleImageLoad = useCallback(() => {
    if (imageRef.current && canvasRef.current) {
      canvasRef.current.width = imageRef.current.naturalWidth;
      canvasRef.current.height = imageRef.current.naturalHeight;
      modelConfigRef.current.overlaySize = [imageRef.current.naturalWidth, imageRef.current.naturalHeight];
      // Clear any existing overlay
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);
  
  const runInference = useCallback(async () => {
    if (!selectedImage || !imageRef.current || !isModelLoaded) return;
    
    setIsProcessing(true);
    setError(null);
    setDetectedObjects([]);
    setInferenceTime(null);
    
    // Create canvas to extract image data
    const canvas = document.createElement("canvas");
    canvas.width = imageRef.current.naturalWidth;
    canvas.height = imageRef.current.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Failed to get canvas context");
      setIsProcessing(false);
      return;
    }
    
    ctx.drawImage(imageRef.current, 0, 0);
    
    // Create bitmap from canvas
    try {
      const bitmap = await createImageBitmap(canvas);
      
      // Send to inference worker
      postInferenceMessage(
        {
          type: "INFERENCE",
          config: modelConfigRef.current,
          bitmap: bitmap,
        },
        [bitmap],
      );
    } catch (err) {
      console.error("Bitmap creation error:", err);
      setError("Failed to process image");
      setIsProcessing(false);
    }
  }, [selectedImage, isModelLoaded, postInferenceMessage]);
  
  const resetImage = useCallback(() => {
    setSelectedImage(null);
    setDetectedObjects([]);
    setInferenceTime(null);
    setError(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Test Inference
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload an image to test object detection AI.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drop an image here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports JPG, PNG, GIF, BMP, WEBP
            </p>
          </div>
        </div>
        
        {/* Selected image and canvas */}
        {selectedImage && (
          <div className="space-y-3">
            <div className="relative">
              <img
                ref={imageRef}
                src={selectedImage}
                className="max-w-full max-h-96 rounded-lg mx-auto block"
                onLoad={handleImageLoad}
                alt="Uploaded image"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-lg"
              />
            </div>
            
            <div className="flex gap-2 justify-center">
              <Button
                onClick={runInference}
                disabled={!isModelLoaded || isProcessing}
                size="sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Run Inference"
                )}
              </Button>
              <Button
                onClick={resetImage}
                variant="outline"
                size="sm"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
        
        {/* Status indicators */}
        {!isModelLoaded && !isLoadingModel && (
          <Button
            onClick={loadModel}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Load AI Model
          </Button>
        )}
        
        {isLoadingModel && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading AI Model...
          </div>
        )}
        
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        
        {/* Results */}
        {inferenceTime && (
          <div className="text-sm text-muted-foreground text-center">
            Inference time: {inferenceTime}ms
          </div>
        )}
        
        {detectedObjects.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Detected Objects:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {detectedObjects.map((obj, idx) => {
                const className = (classes.classes as string[])[obj.classIdx] || `Class ${obj.classIdx}`;
                const confidence = Math.round(obj.score * 100);
                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2 rounded bg-muted/50 text-sm"
                  >
                    <span className="capitalize">{className}</span>
                    <span className="font-mono text-muted-foreground">
                      {confidence}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {selectedImage && detectedObjects.length === 0 && inferenceTime && !isProcessing && (
          <div className="text-center text-sm text-muted-foreground">
            No objects detected
          </div>
        )}
      </CardContent>
    </Card>
  );
};