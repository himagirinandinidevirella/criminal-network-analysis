/**
 * Footer — classification notice and system status.
 */
export default function Footer() {
  return (
    <footer className="flex items-center justify-between border-t border-paper-line bg-paper-raised px-6 py-2 font-mono text-[11px] text-ink-faint">
      <span>© 2025 CrimeNet · Ministry of Home Affairs, Government of India</span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-risk-low" />
        SYSTEM OPERATIONAL · ALL ACCESS LOGGED &amp; MONITORED
      </span>
    </footer>
  );
}
