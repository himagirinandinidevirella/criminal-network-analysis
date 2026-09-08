import { IS_DEMO } from "@/config/runtime";
export default function Footer() {
  return (
    <footer className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-paper-line bg-paper-raised px-4 py-2 font-mono text-[10px] text-ink-soft sm:px-6">
      <span>CrimeNet · Criminal Network Analysis</span>
      <span>
        {IS_DEMO
          ? "SYNTHETIC DATA · FOR SOFTWARE EVALUATION ONLY"
          : "Investigative intelligence workspace"}
      </span>
    </footer>
  );
}
