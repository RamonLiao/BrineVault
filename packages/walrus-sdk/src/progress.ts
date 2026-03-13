// ========== Progress Event Types ==========

export type ProgressStatus =
  | "uploading"
  | "downloading"
  | "retrying"
  | "completed"
  | "failed";

export interface UploadProgress {
  totalChunks: number;
  completedChunks: number;
  overallProgress: number; // 0-100
  failedChunks: number[]; // chunk indices that failed
  status: ProgressStatus;
}

export interface DownloadProgress {
  totalChunks: number;
  completedChunks: number;
  overallProgress: number; // 0-100
  failedChunks: number[];
  status: ProgressStatus;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;
export type DownloadProgressCallback = (progress: DownloadProgress) => void;
