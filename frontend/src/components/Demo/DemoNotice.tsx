import { FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";

export default function DemoNotice() {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-teal/20 bg-teal-soft px-4 py-2 text-xs text-teal sm:px-6"
      role="note"
    >
      <FlaskConical className="h-4 w-4 shrink-0" />
      <strong>Demo workspace</strong>
      <span>
        Synthetic case data · Browser-local processing · No live CCTV or
        blockchain
      </span>
      <Link
        to="/overview"
        className="ml-auto font-semibold underline underline-offset-2"
      >
        About this demo
      </Link>
    </div>
  );
}
