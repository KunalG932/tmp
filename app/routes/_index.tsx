import type {
  MetaFunction,
  ActionFunctionArgs,
  UploadHandler,
} from "@remix-run/node";
import {
  json,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { blobUploadHandler } from "~/lib/blob.server";
import React, { useState, useRef, useEffect } from "react";
import { useToast } from "~/components/hooks/useToast";
import { useFilePaste } from "~/components/hooks/useFilePaste";
import { useUploadProgress } from "~/components/hooks/useUploadProgress";

export const meta: MetaFunction = () => {
  return [
    { title: "tmp" },
    { name: "description", content: "store your files" },
  ];
};

type data = {
  error?: string;
  url?: string;
  token?: string;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  let expiresValue: string | null = null;
  
  // Create a custom upload handler that uses the blobUploadHandler but handles the file
  const uploadHandler: UploadHandler = composeUploadHandlers(
    // Process the multipart form data
    async (args) => {
      // If this is the 'expires' field, handle it separately
      if (args.name === "expires" && args.filename === undefined) {
        // Collect all chunks from the asyncIterable
        const chunks: Uint8Array[] = [];
        for await (const chunk of args.data) {
          chunks.push(chunk);
        }
        
        // Decode the chunks to get the text value
        const text = new TextDecoder().decode(Buffer.concat(chunks));
        // Only set expires if it's not 0 (0 means default behavior - no expiration)
        const value = text.trim();
        expiresValue = value && value !== "0" ? value : null;
        
        return value || undefined;
      }

      // If this is the file field, process it with the blobUploadHandler
      if (args.name === "file" && args.filename) {
        try {
          // Collect all chunks from the asyncIterable
          const chunks: Uint8Array[] = [];
          for await (const chunk of args.data) {
            chunks.push(chunk);
          }
          
          // Create a File object from the chunks
          const mimeType = args.contentType || "application/octet-stream";
          const file = new File(chunks, args.filename, { type: mimeType });
          
          // Create FormData to send to envs.sh
          const formData = new FormData();
          formData.append("file", file);
          
          // Add expiration if we have it and it's not 0
          if (expiresValue) {
            formData.append("expires", expiresValue);
          }
          
          // Send to envs.sh directly
          const response = await fetch("https://envs.sh", {
            method: "POST",
            body: formData,
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
          }
          
          // Return the URL directly
          const url = await response.text();
          return url.trim();
        } catch (error) {
          console.error("File upload failed:", error);
          return undefined;
        }
      }
      
      return undefined;
    },
    // Fallback for any fields not handled above
    createMemoryUploadHandler()
  );
  
  try {
    // Parse the form data with our custom upload handler
    const formData = await parseMultipartFormData(request, uploadHandler);
    
    // Get the file value (which should be the upload URL)
    const fileUrl = formData.get("file");
    
    if (!fileUrl || typeof fileUrl !== "string" || fileUrl.trim() === "") {
      return json({
        error: "No file was uploaded or something went wrong",
      });
    }

    return json({
      url: fileUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return json({
      error: error instanceof Error ? error.message : "Something went wrong while uploading",
    });
  }
};

export default function Index() {
  const fetcher = useFetcher<data>();
  const { toast } = useToast();
  const [isDragActive, setIsDragActive] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | undefined>(undefined);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Use our custom upload progress hook
  const { progress, isUploading, startUpload, completeUpload, resetProgress } = useUploadProgress();

  // Handle fetcher state changes
  useEffect(() => {
    if (fetcher.state === "submitting") {
      startUpload();
    } else if (fetcher.state === "idle" && fetcher.data && !fetcher.data.error) {
      completeUpload();
    }
  }, [fetcher.state, fetcher.data]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      toast({
        description: `Selected file: ${file.name}`,
      });
    }
  };

  // Custom upload function that submits the form with progress tracking
  const handleUpload = async () => {
    if (!selectedFile || !formRef.current) return;

    startUpload();

    const formData = new FormData(formRef.current);
    
    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          // Just update our progress UI directly
          setProgress(percentage);
        }
      });

      // This is just for UI progress tracking - the actual upload is handled by the fetcher
      fetcher.submit(formRef.current);
    } catch (error) {
      console.error("Upload error:", error);
      resetProgress();
      toast({
        description: "Upload failed. Please try again.",
      });
    }
  };
  
  const setProgress = (value: number) => {
    const progressBar = document.getElementById("upload-progress-bar");
    if (progressBar) {
      progressBar.style.width = `${value}%`;
      progressBar.setAttribute("aria-valuenow", value.toString());
    }
  };

  useFilePaste({
    onFilePaste: (file) => {
      setSelectedFile(file);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
      }
      toast({
        description: `Selected file: ${file.name}`,
      });
    },
    fileTypes: ["image/*", "video/*", "audio/*", "application/pdf"],
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
      }
      toast({
        description: `Selected file: ${file.name}`,
      });
    }
  };

  return (
    <>
      <div className="flex h-screen items-center justify-between flex-col gap-3 px-4">
        <div className="flex flex-col items-center gap-3 w-full justify-center h-[-webkit-fill-available]">
          <header className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-black dark:text-white">
              <span className="text-red-600 dark:text-red-700">T</span>mp
            </h1>
            <p className="leading-6 text-gray-700 dark:text-gray-200">
              Uploads up to 512 MB are allowed
            </p>
          </header>
          <fetcher.Form
            ref={formRef}
            method="post"
            encType="multipart/form-data"
            className="flex flex-col gap-2 w-full items-center"
          >
            {/* Progress Bar - visible only during upload */}
            {fetcher.state === "submitting" || isUploading ? (
              <div className="w-full max-w-lg mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div 
                    id="upload-progress-bar"
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress} 
                    aria-valuemin={0} 
                    aria-valuemax={100}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {progress}% Complete
                </p>
              </div>
            ) : null}

            <div
              className={`flex w-full max-w-lg items-center justify-center cursor-pointer ${
                isDragActive ? "bg-gray-200 dark:bg-gray-800" : ""
              }`}
              onDragEnter={handleDragEnter}
              onDrop={handleDrop}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
            >
              <label
                htmlFor="dropzone-file"
                className="flex h-60 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed dark:bg-black bg-white dark:border-gray-600 hover:border-gray-500 transition-colors"
                aria-label="Drop file here"
              >
                <div className="flex flex-col items-center justify-center">
                  {selectedFile ? (
                    <div className="flex flex-col items-center justify-center">
                      <svg 
                        className="mb-4 h-16 w-16 text-green-500" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="mb-2 text-sm font-semibold dark:text-gray-200">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <>
                      <svg
                        className="mb-4 h-16 w-16 text-black dark:text-gray-200"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 16"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                        />
                      </svg>
                      <p className="mb-2 text-sm font-semibold dark:text-gray-200">
                        {isDragActive ? "Drop the file here" : "Upload a File"}
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  id="dropzone-file"
                  name="file"
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <div className="w-full max-w-lg">
              <label htmlFor="expires" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                File expiration (hours, optional)
              </label>
              <input 
                type="number"
                id="expires"
                name="expires"
                min="0"
                max="720" 
                placeholder="Default: 30-90 days depending on file size"
                className="w-full p-2 border dark:border-gray-600 rounded-md bg-white dark:bg-black"
                value={expiresIn || ''}
                onChange={(e) => setExpiresIn(e.target.value ? Number(e.target.value) : undefined)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Files valid for 30-90 days by default based on size. Use 0 for default behavior.
              </p>
            </div>
            <button
              type="submit"
              disabled={fetcher.state === "submitting" || isUploading}
              className={`p-2 dark:bg-white dark:text-black rounded-md w-full max-w-lg hover:translate-y-1 transition-transform duration-200 ease-in-out ${
                (fetcher.state === "submitting" || isUploading) ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {fetcher.state === "submitting" || isUploading ? "Uploading..." : "Upload"}
            </button>
          </fetcher.Form>
          <div className="w-fit">
            {fetcher.data ? (
              fetcher.data?.error ? (
                <h2 className="text-red-400">{fetcher.data.error}</h2>
              ) : (
                <p>
                  File has been uploaded and is available under the following
                  URL:
                  <br />
                  <a href={fetcher.data.url} className="break-all text-sm">
                    {fetcher.data.url}
                  </a>
                </p>
              )
            ) : null}
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          <p>Powered by <a href="https://envs.sh" className="hover:underline">envs.sh</a></p>
          <div className="mt-1">
            Source -&gt;{" "}
            <a className="hover:underline" href="https://github.com/qewertyy/tmp">
              Github{" "}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
