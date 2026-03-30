import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Converts raw byte count to human-readable string with 1 decimal place and appropriate unit
// Examples: 512 -> "512 B", 1536 -> "1.5 KB", 1572864 -> "1.5 MB", 1610612736 -> "1.5 GB"
// Used in: file rows (size column), summary bar (reclaim amount), delete panel (total to free)
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
