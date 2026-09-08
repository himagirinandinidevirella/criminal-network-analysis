import { IS_DEMO } from "@/config/runtime";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
/**
 * InvestigatorActions — action toolbar for a criminal (verify/note/evidence/flag/share).
 */
import { useState } from "react";
import {
  BadgeCheck,
  FileText,
  Paperclip,
  Star,
  Share2,
  AlertTriangle,
  Archive,
  Fingerprint,
} from "lucide-react";
import { postForm } from "@/services/api";
import { uploadEvidence } from "@/services/blockchainService";
import {
  successToast,
  errorToast,
} from "@/components/Common/ToastNotification";
import NotesEditor from "./NotesEditor";
import EvidenceUploader from "./EvidenceUploader";
import ShareReport from "./ShareReport";
import ConfirmModal from "@/components/Common/ConfirmModal";

interface Props {
  criminalId: string;
  onChanged?: () => void;
  verified?: boolean;
  flagged?: boolean;
}

export default function InvestigatorActions({
  criminalId,
  onChanged,
  verified = false,
  flagged = false,
}: Props) {
  const user = useSelector((state: RootState) => state.auth.user);
  const [busy, setBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [confirmFlag, setConfirmFlag] = useState(false);
  const [showChain, setShowChain] = useState(false);
  const [chainFile, setChainFile] = useState<File | null>(null);
  const [chainCase, setChainCase] = useState("");
  const [chainUploading, setChainUploading] = useState(false);

  const chainUpload = async () => {
    if (!chainFile) {
      errorToast("Select a file to secure on-chain");
      return;
    }
    setChainUploading(true);
    try {
      const result = await uploadEvidence(
        criminalId,
        chainFile,
        chainCase || "OP-MUM-01",
        "DIGITAL",
        "Secured from investigation workspace",
      );
      successToast(
        `Evidence secured on-chain — ${result.ipfs_hash.slice(0, 10)}…`,
      );
      setShowChain(false);
      setChainFile(null);
    } catch {
      errorToast("Blockchain upload failed");
    } finally {
      setChainUploading(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("officer_badge", user?.badge_id ?? "demo");
      await postForm(`/api/actions/verify/${criminalId}`, form);
      successToast(
        IS_DEMO
          ? "Demo record marked as reviewed"
          : "Information marked as verified",
      );
      onChanged?.();
    } catch {
      errorToast("Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const flag = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("priority", "5");
      form.append("reason", "Flagged for review by officer");
      await postForm(`/api/actions/flag/${criminalId}`, form);
      successToast("Added to priority watchlist");
      onChanged?.();
    } catch {
      errorToast("Flag failed");
    } finally {
      setBusy(false);
      setConfirmFlag(false);
    }
  };

  const actions = [
    {
      label: verified ? "Verified" : "Verify",
      icon: BadgeCheck,
      onClick: verify,
      disabled: verified,
    },
    { label: "Notes", icon: FileText, onClick: () => setShowNotes(true) },
    {
      label: IS_DEMO ? "File checksum" : "Evidence",
      icon: Paperclip,
      onClick: () => setShowEvidence(true),
    },
    ...(!IS_DEMO
      ? [
          {
            label: "Secure",
            icon: Fingerprint,
            onClick: () => setShowChain(true),
            disabled: false,
          },
        ]
      : []),
    {
      label: flagged ? "Flagged" : "Flag",
      icon: Star,
      onClick: () => setConfirmFlag(true),
      disabled: flagged,
    },
    { label: "Share", icon: Share2, onClick: () => setShowShare(true) },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ label, icon: Icon, onClick, disabled }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={busy || disabled}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-hover disabled:opacity-50"
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {showNotes && (
        <NotesEditor
          criminalId={criminalId}
          onClose={() => {
            setShowNotes(false);
            onChanged?.();
          }}
        />
      )}
      {showEvidence && (
        <EvidenceUploader
          criminalId={criminalId}
          onClose={() => {
            setShowEvidence(false);
            onChanged?.();
          }}
        />
      )}
      {showShare && (
        <ShareReport
          criminalId={criminalId}
          onClose={() => setShowShare(false)}
        />
      )}

      {showChain && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowChain(false)}
        >
          <div
            className="glass w-full max-w-md rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold">
              Secure Evidence on Blockchain
            </h3>
            <p className="mb-4 text-xs text-text-muted">
              The file is stored on IPFS and its SHA-256 fingerprint is
              committed to the immutable ledger.
            </p>
            <input
              value={chainCase}
              onChange={(e) => setChainCase(e.target.value)}
              placeholder="Case number (default OP-MUM-01)"
              className="mb-3 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
            />
            <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border p-6 text-sm text-text-secondary transition hover:border-seal">
              <Fingerprint className="h-6 w-6 text-accent-cyan" />
              {chainFile ? chainFile.name : "Click to choose evidence file"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => setChainFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={chainUpload}
              disabled={!chainFile || chainUploading}
              className="w-full rounded-lg bg-accent-blue py-2.5 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
            >
              {chainUploading ? "Committing to chain…" : "Secure on blockchain"}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmFlag}
        title="Mark as important?"
        message={
          IS_DEMO
            ? "Add this fictional record to the local priority watchlist? No notification will be sent."
            : "This will add the record to the priority watchlist."
        }
        confirmLabel="Flag as priority"
        danger
        onConfirm={flag}
        onCancel={() => setConfirmFlag(false)}
      />
    </>
  );
}
