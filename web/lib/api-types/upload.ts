export type ChatUploadResult = {
  id: string;
  type: "image" | "document";
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  bucket: string;
  signedUrl: string;
};
