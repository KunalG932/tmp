import { useState } from "react";

interface UseUploadProgressOptions {
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

export function useUploadProgress(options: UseUploadProgressOptions = {}) {
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const trackProgress = (event: ProgressEvent) => {
    if (event.lengthComputable) {
      const percentage = Math.round((event.loaded / event.total) * 100);
      setProgress(percentage);
      options.onProgress?.(percentage);
      
      if (percentage === 100) {
        options.onComplete?.();
      }
    }
  };

  const startUpload = () => {
    setProgress(0);
    setIsUploading(true);
  };

  const completeUpload = () => {
    setProgress(100);
    setIsUploading(false);
  };

  const resetProgress = () => {
    setProgress(0);
    setIsUploading(false);
  };

  return {
    progress,
    isUploading,
    trackProgress,
    startUpload,
    completeUpload,
    resetProgress,
  };
}