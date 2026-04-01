export type TaskStatus = "成功" | "失败" | "处理中";

export interface ImagePair {
  id: number;
  name: string;
  subtaskNo: string;
  subtaskId: string;
  taskId: string;
  operationType: string;
  userId: string;
  date: string;
  status: TaskStatus;
  original: string;
  result: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number | null;
  originalCount: number;
  resultCount: number;
  subTaskCount: number;
  promptId: string;
  promptText: string;
  errorMessage: string;
  model: string;
  toolType: string;
  outputResolution: string;
  originalWidth: number | null;
  originalHeight: number | null;
  requestedWidth: number | null;
  requestedHeight: number | null;
  enhanced: boolean | null;
  creativeStrength: number | null;
  referenceStrength: number | null;
  requestedCount: number | null;
  auxImageCount: number;
  hasMask: boolean;
}

export function getThumbnailUrl(url: string, width = 200, height?: number): string {
  if (!url) return "";

  if (!url.includes("aliyuncs.com") && !url.includes("oss-")) {
    return url;
  }

  const cleanUrl = url.split("?")[0];
  let processParam = `image/resize,w_${width}`;
  if (height) {
    processParam += `,h_${height}`;
  }
  processParam += ",m_lfit";

  return `${cleanUrl}?x-oss-process=${processParam}`;
}

export function getListThumbnail(url: string): string {
  return getThumbnailUrl(url, 300);
}

export function getSmallThumbnail(url: string): string {
  return getThumbnailUrl(url, 150);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return "未完成";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function formatSize(width: number | null, height: number | null): string {
  if (!width || !height) return "未知尺寸";
  return `${width}×${height}`;
}

export function formatDateTime(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getErrorSummary(message: string): string {
  if (!message) return "";
  if (message.includes("处理超时")) return "处理超时";
  if (message.includes("OversizeImage")) return "输入图片过大";
  if (message.includes("context deadline exceeded")) return "工作流超时";
  if (message.includes("Workflow执行失败")) return "工作流执行失败";
  return message.split("\n")[0].trim();
}
