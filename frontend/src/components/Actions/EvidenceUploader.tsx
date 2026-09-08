import { IS_DEMO } from "@/config/runtime";
/**
 * EvidenceUploader — drag-and-drop evidence file upload with chain of custody.
 */
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X } from "lucide-react";
import { postForm, apiErrorMessage } from "@/services/api";
import {
  successToast,
  errorToast,
} from "@/components/Common/ToastNotification";

interface Props {
  criminalId: string;
  onClose: () => void;
}

export default function EvidenceUploader({ criminalId, onClose }: Props) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("file_type", "DOCUMENT");
      await postForm(`/api/actions/evidence/${criminalId}`, form);
      successToast(
        IS_DEMO
          ? "File checksum recorded locally; file contents were not stored"
          : "Evidence uploaded with chain of custody",
      );
      onClose();
    } catch (error) {
      errorToast(apiErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass w-full max-w-md rounded-2xl p-6"
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.92 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">
              {IS_DEMO ? "Register a file checksum" : "Upload Evidence"}
            </h3>
            <button onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {IS_DEMO && (
            <p className="mb-3 text-xs text-ink-soft">
              Only the file name, size and SHA-256 checksum are stored locally.
              The file is not uploaded or retained. Maximum 5 MB. Use synthetic
              data only.
            </p>
          )}
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            aria-label="Choose a file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              setFile(e.dataTransfer.files[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition ${
              dragging
                ? "border-seal bg-seal-soft"
                : "border-paper-line hover:border-seal"
            }`}
          >
            <UploadCloud className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-secondary">
              {file ? file.name : "Drag & drop PDF / image / video / audio"}
            </p>
            <input
              ref={inputRef}
              type="file"
              aria-label="Evidence file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button
            onClick={upload}
            disabled={!file || uploading}
            className="mt-4 w-full rounded-lg bg-accent-blue py-2.5 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
          >
            {uploading
              ? "Processing…"
              : IS_DEMO
                ? "Record checksum"
                : "Upload with chain of custody"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
