import type { ReportRequest } from "@/services/exportService";
import { DEMO_NOTICE } from "./data";
import { communities, fullGraph, profile, statistics } from "./analysis";
import type { DemoReport, DemoReportType, DemoState } from "./types";

export const DEMO_REPORT_SECTIONS: Record<DemoReportType, string[]> = {
  criminal: [
    "Personal Profile",
    "Network Connections",
    "Sample Risk Assessment",
    "Crime History",
    "Vehicles",
    "Accounts",
    "Investigator Notes",
  ],
  network: ["Network Summary", "Entities", "Relationships", "Seeded Networks"],
  case: ["Case Details", "Linked Persons", "Investigator Notes"],
  executive: ["Network Summary", "Active Alerts", "Seeded Networks"],
};

/** A snapshot is saved with the report so history downloads don't silently change. */
export function buildReport(
  state: DemoState,
  type: DemoReportType,
  entityId: string,
  request: ReportRequest,
): DemoReport {
  let available: Record<string, unknown>;
  let subject = "Operation Mumbai";
  if (type === "criminal") {
    const p = profile(state, entityId);
    subject = p.person.name;
    available = {
      "Personal Profile": p.person,
      "Network Connections": p.associates,
      "Sample Risk Assessment": {
        ...p.risk,
        notice:
          "Illustrative fixture values only; not a model prediction or SHAP explanation.",
      },
      "Crime History": p.crimes,
      Vehicles: p.vehicles,
      Accounts: p.accounts,
      "Investigator Notes": state.notes.filter(
        (n) => n.criminal_id === entityId,
      ),
    };
  } else if (type === "case") {
    const c = state.crimes.find(
      (c) => c.id === entityId || c.case_number === entityId,
    );
    if (!c) throw new Error("Case not found");
    subject = c.case_number ?? c.id;
    available = {
      "Case Details": c,
      "Linked Persons": state.people.filter((p) => c.person_ids.includes(p.id)),
      "Investigator Notes": state.notes.filter((n) =>
        c.person_ids.includes(n.criminal_id),
      ),
    };
  } else if (type === "network") {
    const g = fullGraph(state);
    available = {
      "Network Summary": statistics(state),
      Entities: g.nodes.map((n) => n.data),
      Relationships: g.edges.map((e) => e.data),
      "Seeded Networks": communities(state),
    };
  } else {
    available = {
      "Network Summary": statistics(state),
      "Active Alerts": state.alerts.filter((a) => a.status !== "RESOLVED"),
      "Seeded Networks": communities(state),
    };
  }
  const wanted = request.sections ?? Object.keys(available);
  const sections = Object.fromEntries(
    Object.entries(available).filter(([key]) => wanted.includes(key)),
  );
  if (!Object.keys(sections).length)
    throw new Error("Select at least one report section");
  return {
    id: crypto.randomUUID(),
    title: `${type[0].toUpperCase() + type.slice(1)} report - ${subject}`,
    report_type: type,
    entity_id: entityId || "operation-mumbai",
    format: request.format,
    classification: request.classification,
    created_at: new Date().toISOString(),
    notice: DEMO_NOTICE,
    sections,
  };
}

export function reportFilename(
  report: Pick<DemoReport, "id" | "report_type" | "format">,
): string {
  return `demo_${report.report_type}_${report.id.slice(0, 8)}.${report.format === "EXCEL" ? "xlsx" : report.format.toLowerCase()}`;
}

export function flattenReport(
  report: DemoReport,
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  const walk = (section: string, field: string, value: unknown): void => {
    if (Array.isArray(value) && value.length)
      value.forEach((v, i) => walk(section, `${field}[${i + 1}]`, v));
    else if (value && typeof value === "object" && Object.keys(value).length)
      Object.entries(value).forEach(([key, v]) =>
        walk(section, field ? `${field}.${key}` : key, v),
      );
    else
      rows.push({
        Section: section,
        Field: field || "value",
        Value:
          value == null ? "" : Array.isArray(value) ? "None" : String(value),
      });
  };
  walk("Metadata", "notice", report.notice);
  walk("Metadata", "title", report.title);
  walk("Metadata", "created_at", report.created_at);
  walk("Metadata", "classification", report.classification);
  Object.entries(report.sections).forEach(([key, value]) =>
    walk(key, "", value),
  );
  return rows;
}

/** CSV fields that look like spreadsheet formulae are emitted as literal text. */
export function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function renderReport(report: DemoReport): Promise<Blob> {
  if (report.format === "JSON")
    return new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
  const rows = flattenReport(report);
  if (report.format === "CSV") {
    const data = [Object.keys(rows[0]), ...rows.map((r) => Object.values(r))]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n");
    return new Blob(["\uFEFF", data], { type: "text/csv;charset=utf-8" });
  }
  if (report.format === "EXCEL") {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CrimeNet synthetic demo";
    const sheet = workbook.addWorksheet("Demo report");
    sheet.columns = [
      { header: "Section", key: "Section", width: 26 },
      { header: "Field", key: "Field", width: 38 },
      { header: "Value", key: "Value", width: 85 },
    ];
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1B2530" },
    };
    sheet.getColumn(3).alignment = { wrapText: true, vertical: "top" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setProperties({
    title: report.title,
    subject: "Synthetic demonstration only",
    author: "CrimeNet demo",
  });
  const ascii = (s: string) =>
    s
      .replace(/₹/g, "INR ")
      .replace(/[—–]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[^\x20-\x7E\n]/g, "?");
  let y = 24;
  const header = () => {
    doc.setFontSize(9);
    doc.setTextColor(193, 59, 38);
    doc.text("CRIMENET | SYNTHETIC DEMO - NOT EVIDENCE", 14, 12);
    doc.setTextColor(27, 37, 48);
  };
  header();
  const line = (text: string, size = 9) => {
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(ascii(text), 180);
    for (const value of lines) {
      if (y > 278) {
        doc.addPage();
        header();
        y = 24;
        doc.setFontSize(size);
      }
      doc.text(value, 14, y);
      y += size === 9 ? 5 : 7;
    }
  };
  line(report.title, 16);
  y += 3;
  line(DEMO_NOTICE);
  y += 3;
  let section = "";
  for (const row of rows) {
    if (section !== row.Section) {
      section = row.Section;
      y += 4;
      line(section, 12);
    }
    line(`${row.Field}: ${row.Value}`);
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Demo copy | ${i} / ${pages}`, 14, 290);
  }
  return doc.output("blob");
}
