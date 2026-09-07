/**
 * NotesEditor — rich-text investigator notes (react-quill).
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { postForm } from "@/services/api";
import { successToast, errorToast } from "@/components/Common/ToastNotification";

interface Props {
  criminalId: string;
  onClose: () => void;
}

export default function NotesEditor({ criminalId, onClose }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("note_content", content);
      form.append("note_type", "INVESTIGATION");
      await postForm(`/api/actions/notes/${criminalId}`, form);
      successToast("Note saved");
      onClose();
    } catch {
      errorToast("Could not save note");
    } finally {
      setSaving(false);
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
          className="glass w-full max-w-lg rounded-2xl p-6"
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.92 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Investigator Note</h3>
            <button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            placeholder="Write your investigation notes…"
          />
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 w-full rounded-lg bg-accent-blue py-2.5 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Note"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
