import type { UploadHandler } from "@remix-run/node";
import mime from "mime";

interface BlobUploadOptions {
  data: AsyncIterable<Uint8Array>;
  filename: string;
  expires?: string | number | null;
  onProgress?: (progress: number) => void;
}

async function blobUpload({
  data,
  filename,
  expires,
  onProgress
}: BlobUploadOptions): Promise<any> {
  const formData = new FormData();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  // First pass: collect chunks and calculate total size
  for await (const chunk of data) {
    chunks.push(chunk);
    totalSize += chunk.byteLength;
  }
  
  const mimeType = mime.getType(filename) || "application/octet-stream";
  const file = new File(chunks, filename, { type: mimeType });
  formData.append("file", file);
  
  // Add expiration time if provided
  if (expires) {
    formData.append("expires", expires.toString());
  }

  // Using envs.sh API
  const xhr = new XMLHttpRequest();
  
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Get the token from headers
        const token = xhr.getResponseHeader("X-Token");
        // Get the URL from response text
        const url = xhr.responseText.trim();
        resolve({ url, token });
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error occurred during upload'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'));
    });
    
    xhr.open('POST', 'https://envs.sh');
    xhr.send(formData);
  });
}

// URL Shortening function using envs.sh
export async function shortenUrl(url: string): Promise<string | undefined> {
  try {
    const formData = new FormData();
    formData.append("shorten", url);

    const response = await fetch("https://envs.sh", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to shorten URL: ${response.status}`);
    }

    const shortUrl = await response.text();
    return shortUrl.trim();
  } catch (error) {
    console.error("URL shortening failed:", error);
    return undefined;
  }
}

// URL upload function using envs.sh
export async function uploadUrl(url: string, expires?: string | number): Promise<string | undefined> {
  try {
    const formData = new FormData();
    formData.append("url", url);
    
    if (expires) {
      formData.append("expires", expires.toString());
    }

    const response = await fetch("https://envs.sh", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload URL: ${response.status}`);
    }

    const resultUrl = await response.text();
    return resultUrl.trim();
  } catch (error) {
    console.error("URL upload failed:", error);
    return undefined;
  }
}

export const blobUploadHandler: UploadHandler = async ({
  name,
  filename,
  data,
}) => {
  if (name !== "file" || !filename) {
    return undefined;
  }
  
  try {
    const res = await blobUpload({ 
      data, 
      filename,
      // Note: expires should be passed from the action function
      // onProgress is not available here since we're in server context
    });
    
    if (res?.url) {
      // Return the URL directly since envs.sh returns just the URL as text
      return res.url;
    }
    return undefined;
  } catch (error) {
    console.error("File upload failed:", error);
    return undefined;
  }
};
