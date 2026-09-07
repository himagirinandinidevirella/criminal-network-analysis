/**
 * ExportOptions — format picker and watermark toggle.
 */
interface Props {
  format: string;
  onFormatChange: (f: "PDF" | "CSV" | "EXCEL" | "JSON") => void;
  watermark: boolean;
  onWatermarkChange: (w: boolean) => void;
}

const FORMATS: Array<"PDF" | "CSV" | "EXCEL" | "JSON"> = ["PDF", "CSV", "EXCEL", "JSON"];

export default function ExportOptions({ format, onFormatChange, watermark, onWatermarkChange }: Props) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-text-secondary">Export format</p>
      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map((f) => (
          <label key={f} className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
            <input
              type="radio"
              name="format"
              checked={format === f}
              onChange={() => onFormatChange(f)}
              className="accent-accent-blue"
            />
            {f}
          </label>
        ))}
        <label className="ml-4 flex items-center gap-1.5 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={watermark}
            onChange={(e) => onWatermarkChange(e.target.checked)}
            className="rounded accent-accent-blue"
          />
          Add classification watermark
        </label>
      </div>
    </div>
  );
}
