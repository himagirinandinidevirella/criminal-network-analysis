/**
 * ReportViewer — simple in-app preview of a report's section data.
 */
import { FileText } from "lucide-react";

interface Props {
  title: string;
  data: Record<string, unknown>;
}

export default function ReportViewer({ title, data }: Props) {
  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-accent-blue" /> {title}
      </h3>
      <pre className="max-h-80 overflow-auto rounded-lg bg-bg-tertiary p-3 text-xs text-text-secondary">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
