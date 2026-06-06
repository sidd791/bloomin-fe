import { useState, useCallback, useRef } from 'react';
import { APIService } from '../services/api.service';
import {
  validateFile,
  UPLOAD_MAX_FILES,
  UPLOAD_POLL_INTERVAL,
  UPLOAD_STATUS,
} from '../lib/file-upload';

function createAttachment(file) {
  return {
    localId: crypto.randomUUID(),
    file,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    status: UPLOAD_STATUS.UPLOADING,
    progress: 0,
    fileId: null,
    previewUrl: null,
    expiresAt: null,
    error: null,
    localPreview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  };
}

export function useFileUpload() {
  const [attachments, setAttachments] = useState([]);
  const pollTimers = useRef(new Map());

  const updateAttachment = useCallback((localId, updates) => {
    setAttachments((prev) =>
      prev.map((a) => (a.localId === localId ? { ...a, ...updates } : a)),
    );
  }, []);

  const pollStatus = useCallback((localId, fileId) => {
    const poll = async () => {
      try {
        const result = await APIService.getUploadStatus(fileId);
        if (result.status === 'processed') {
          clearInterval(pollTimers.current.get(localId));
          pollTimers.current.delete(localId);
          updateAttachment(localId, {
            status: UPLOAD_STATUS.READY,
            previewUrl: result.preview_url || null,
          });
        } else if (result.status === 'failed') {
          clearInterval(pollTimers.current.get(localId));
          pollTimers.current.delete(localId);
          updateAttachment(localId, {
            status: UPLOAD_STATUS.ERROR,
            error: result.error || 'Could not process file. Try a different format.',
          });
        }
      } catch {
        clearInterval(pollTimers.current.get(localId));
        pollTimers.current.delete(localId);
        updateAttachment(localId, {
          status: UPLOAD_STATUS.ERROR,
          error: 'Failed to check file status.',
        });
      }
    };

    const timer = setInterval(poll, UPLOAD_POLL_INTERVAL);
    pollTimers.current.set(localId, timer);
  }, [updateAttachment]);

  const uploadFile = useCallback(async (attachment) => {
    try {
      const result = await APIService.uploadFile(
        attachment.file,
        (progress) => updateAttachment(attachment.localId, { progress }),
      );

      const updates = {
        fileId: result.file_id,
        filename: result.filename,
        // Keep the original mimeType (from file.type) if the server omits it
        mimeType: result.mime_type || attachment.mimeType,
        sizeBytes: result.size_bytes,
        previewUrl: result.preview_url || null,
        expiresAt: result.expires_at || null,
        progress: 100,
      };

      if (result.status === 'processed') {
        updates.status = UPLOAD_STATUS.READY;
      } else if (result.status === 'failed') {
        updates.status = UPLOAD_STATUS.ERROR;
        updates.error = 'Could not process file. Try a different format.';
      } else {
        updates.status = UPLOAD_STATUS.PROCESSING;
        pollStatus(attachment.localId, result.file_id);
      }

      updateAttachment(attachment.localId, updates);
    } catch (err) {
      updateAttachment(attachment.localId, {
        status: UPLOAD_STATUS.ERROR,
        error: err.message || 'Upload failed. Tap to retry.',
      });
    }
  }, [updateAttachment, pollStatus]);

  const addFiles = useCallback((files) => {
    const fileArray = Array.from(files);
    const results = [];

    setAttachments((prev) => {
      const remaining = UPLOAD_MAX_FILES - prev.length;
      if (remaining <= 0) return prev;

      const toAdd = fileArray.slice(0, remaining);
      const newAttachments = [];

      for (const file of toAdd) {
        const validationError = validateFile(file);
        if (validationError) {
          results.push({ file, error: validationError });
          continue;
        }
        const attachment = createAttachment(file);
        newAttachments.push(attachment);
        results.push({ file, attachment });
      }

      if (fileArray.length > remaining) {
        results.push({
          error: `Maximum ${UPLOAD_MAX_FILES} files per message. ${fileArray.length - remaining} file(s) skipped.`,
        });
      }

      for (const { attachment } of results.filter((r) => r.attachment)) {
        uploadFile(attachment);
      }

      return [...prev, ...newAttachments];
    });

    return results;
  }, [uploadFile]);

  const retryUpload = useCallback((localId) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.localId === localId);
      if (!target?.file) return prev;
      uploadFile({ ...target, status: UPLOAD_STATUS.UPLOADING, progress: 0, error: null });
      return prev.map((a) =>
        a.localId === localId
          ? { ...a, status: UPLOAD_STATUS.UPLOADING, progress: 0, error: null }
          : a,
      );
    });
  }, [uploadFile]);

  const removeAttachment = useCallback((localId) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.localId === localId);
      if (target?.localPreview) URL.revokeObjectURL(target.localPreview);
      if (target?.fileId) {
        APIService.deleteUpload(target.fileId).catch(() => {});
      }
      const timer = pollTimers.current.get(localId);
      if (timer) {
        clearInterval(timer);
        pollTimers.current.delete(localId);
      }
      return prev.filter((a) => a.localId !== localId);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const a of prev) {
        if (a.localPreview) URL.revokeObjectURL(a.localPreview);
      }
      return [];
    });
    for (const timer of pollTimers.current.values()) {
      clearInterval(timer);
    }
    pollTimers.current.clear();
  }, []);

  const allReady = attachments.length > 0 && attachments.every(
    (a) => a.status === UPLOAD_STATUS.READY,
  );

  const hasUploading = attachments.some(
    (a) => a.status === UPLOAD_STATUS.UPLOADING || a.status === UPLOAD_STATUS.PROCESSING,
  );

  const canAttachMore = attachments.length < UPLOAD_MAX_FILES;

  const getAttachmentsPayload = useCallback(() => {
    return attachments
      .filter((a) => a.fileId && a.status === UPLOAD_STATUS.READY)
      .map((a) => ({ file_id: a.fileId, filename: a.filename }));
  }, [attachments]);

  const isExpired = useCallback((attachment) => {
    if (!attachment.expiresAt) return false;
    return new Date() > new Date(attachment.expiresAt);
  }, []);

  return {
    attachments,
    addFiles,
    removeAttachment,
    retryUpload,
    clearAttachments,
    allReady,
    hasUploading,
    canAttachMore,
    getAttachmentsPayload,
    isExpired,
  };
}
