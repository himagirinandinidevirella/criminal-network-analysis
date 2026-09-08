import { describe, expect, it } from "vitest";
import { seedDemoState } from "@/demo/data";
import {
  buildReport,
  csvCell,
  renderReport,
  reportFilename,
} from "@/demo/reports";
import { sha256 } from "@/demo/store";
import type { ReportFormat } from "@/demo/types";

const report = (format: ReportFormat) =>
  buildReport(seedDemoState(), "criminal", "raja-khan", {
    format,
    classification: "SYNTHETIC DEMO",
    sections: ["Personal Profile"],
  });
describe("real report files", () => {
  it("generates labeled JSON and CSV with only selected sections", async () => {
    const json = JSON.parse(await (await renderReport(report("JSON"))).text());
    expect(json.notice).toContain("SYNTHETIC DEMO");
    expect(Object.keys(json.sections)).toEqual(["Personal Profile"]);
    const csv = await (await renderReport(report("CSV"))).text();
    expect(csv).toContain('"Section","Field","Value"');
    expect(csv).toContain("Raja Khan");
    expect(csv).toContain("SYNTHETIC DEMO");
    expect(csv).not.toContain("Sample Risk Assessment");
  });
  it("escapes spreadsheet formula injection and quotes", () => {
    expect(csvCell('=HYPERLINK("example")')).toBe(
      '"\'=HYPERLINK(""example"")"',
    );
    expect(csvCell("+123")).toBe('"\'+123"');
    expect(csvCell("Normal, text")).toBe('"Normal, text"');
  });
  it("generates a readable XLSX workbook with the proper extension", async () => {
    const r = report("EXCEL"),
      blob = await renderReport(r);
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.worksheets[0].getCell("A1").value).toBe("Section");
    expect(workbook.worksheets[0].getCell("C2").value).toContain(
      "SYNTHETIC DEMO",
    );
    expect(reportFilename(r)).toMatch(/\.xlsx$/);
  });
  it("generates a real PDF document, not a mislabeled text file", async () => {
    const pdf = await renderReport(report("PDF"));
    expect(pdf.type).toBe("application/pdf");
    expect((await pdf.text()).startsWith("%PDF-")).toBe(true);
    expect(await pdf.text()).toContain("SYNTHETIC DEMO");
  });
  it("uses distinct report types and rejects missing cases/empty sections", () => {
    const state = seedDemoState(),
      options = { format: "JSON" as const, classification: "DEMO" };
    expect(
      buildReport(state, "case", "case-1", options).sections,
    ).toHaveProperty("Case Details");
    expect(buildReport(state, "network", "", options).sections).toHaveProperty(
      "Relationships",
    );
    expect(
      buildReport(state, "executive", "", options).sections,
    ).toHaveProperty("Active Alerts");
    expect(() => buildReport(state, "case", "missing", options)).toThrow(
      "Case not found",
    );
    expect(() =>
      buildReport(state, "criminal", "raja-khan", { ...options, sections: [] }),
    ).toThrow("at least one");
  });
  it("calculates actual SHA-256 and detects a one-character change", async () => {
    expect(await sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await sha256("abc")).not.toBe(await sha256("abd"));
  });
});
