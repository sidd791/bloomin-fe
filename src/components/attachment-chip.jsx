import React from 'react'
import { X, FileText, FileSpreadsheet, FileImage, Presentation, RotateCcw, Check, AlertCircle, Loader2 } from 'lucide-react'
import {
  getFileType,
  formatFileSize,
  FILE_TYPE_COLORS,
  FILE_TYPE_LABELS,
  UPLOAD_STATUS,
  isImageFile,
} from '../lib/file-upload'
import { useAuthenticatedImage } from '../hooks/use-authenticated-image'

const TYPE_ICONS = {
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  powerpoint: Presentation,
  text: FileText,
  image: FileImage,
}

function StatusIndicator({ status, progress }) {
  if (status === UPLOAD_STATUS.UPLOADING) {
    return (
      <div className="relative h-4 w-4">
        <svg className="h-4 w-4 -rotate-90" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/20" />
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-500"
            strokeDasharray={`${(progress / 100) * 37.7} 37.7`} strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  if (status === UPLOAD_STATUS.PROCESSING) {
    return <Loader2 className="h-3.5 w-3.5 text-pink-500 animate-spin" />
  }
  if (status === UPLOAD_STATUS.READY) {
    return <Check className="h-3.5 w-3.5 text-green-500" />
  }
  if (status === UPLOAD_STATUS.ERROR || status === UPLOAD_STATUS.EXPIRED) {
    return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  }
  return null
}

export function AttachmentChip({ attachment, onRemove, onRetry, removable = true }) {
  const fileType = getFileType(attachment.filename)
  const Icon = TYPE_ICONS[fileType] || FileText
  const bgColor = FILE_TYPE_COLORS[fileType] || 'bg-gray-500'
  const label = FILE_TYPE_LABELS[fileType] || 'FILE'
  // Fall back to filename-based detection in case mimeType was not returned by server
  const isImage = isImageFile(attachment.mimeType) || fileType === 'image'
  const rawPreviewSrc = attachment.localPreview || attachment.previewUrl
  const previewSrc = useAuthenticatedImage(isImage ? rawPreviewSrc : null)
  const isError = attachment.status === UPLOAD_STATUS.ERROR || attachment.status === UPLOAD_STATUS.EXPIRED
  const canRetry = isError && onRetry

  return (
    <div className={`relative flex items-center gap-3 bg-background border rounded-xl p-2 w-max max-w-[260px] shadow-sm group transition-colors ${
      isError ? 'border-red-500/40' : 'border-border'
    } ${removable ? 'pr-7' : 'pr-3'}`}>
      {isImage && previewSrc ? (
        <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-muted">
          <img src={previewSrc} alt={attachment.filename} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className={`h-10 w-10 ${bgColor} rounded-lg flex items-center justify-center shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      )}

      <div className="flex flex-col overflow-hidden text-left min-w-0">
        <span className="text-sm font-medium truncate text-foreground">{attachment.filename}</span>
        <div className="flex items-center gap-1.5">
          {isError ? (
            <span className="text-xs text-red-400 truncate">
              {attachment.status === UPLOAD_STATUS.EXPIRED ? 'Expired — re-upload' : attachment.error}
            </span>
          ) : (
            <>
              <span className="text-xs text-muted-foreground uppercase font-semibold">{label}</span>
              {attachment.sizeBytes > 0 && (
                <span className="text-xs text-muted-foreground">{formatFileSize(attachment.sizeBytes)}</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 ml-auto">
        {canRetry ? (
          <button
            type="button"
            onClick={() => onRetry(attachment.localId)}
            className="p-1 text-red-400 hover:text-red-300 transition-colors"
            title="Retry upload"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : (
          <StatusIndicator status={attachment.status} progress={attachment.progress} />
        )}
      </div>

      {removable && (
        <button
          type="button"
          onClick={() => onRemove(attachment.localId)}
          className="absolute -top-2 -right-2 bg-muted text-foreground border rounded-full p-1 hover:bg-foreground hover:text-background transition-colors opacity-0 group-hover:opacity-100"
          title="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function AttachmentBadge({ attachment }) {
  const fileType = getFileType(attachment.filename || attachment.name)
  const Icon = TYPE_ICONS[fileType] || FileText
  const bgColor = FILE_TYPE_COLORS[fileType] || 'bg-gray-500'
  // Fall back to filename-based detection in case mime_type is absent
  const isImage = isImageFile(attachment.mime_type || attachment.mimeType || '') || fileType === 'image'
  const rawPreviewSrc = attachment.preview_url || attachment.previewUrl
  // Authenticated fetch is required because the preview endpoint needs an auth header
  const previewSrc = useAuthenticatedImage(isImage ? rawPreviewSrc : null)

  return (
    <div className="inline-flex items-center gap-2 bg-muted/10 border rounded-lg p-1.5 pr-3 w-max max-w-full">
      {isImage && previewSrc ? (
        <div className="h-8 w-8 rounded-md overflow-hidden shrink-0 bg-muted">
          <img src={previewSrc} alt={attachment.filename || attachment.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className={`h-8 w-8 ${bgColor} rounded-md flex items-center justify-center shrink-0`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      )}
      <span className="text-xs font-medium truncate text-foreground">{attachment.filename || attachment.name}</span>
    </div>
  )
}
