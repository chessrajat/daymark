import pdfmake from "pdfmake";
import fonts from "pdfmake/fonts/Roboto";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { reportTypes, type ReportFilters, type ReportResult } from "./reports";

pdfmake.addFonts(fonts);
pdfmake.setUrlAccessPolicy(() => false);
const table = (headers: string[], rows: TableCell[][], widths: (string | number)[]): Content => ({
  table: { headerRows: 1, widths, dontBreakRows: true, keepWithHeaderRows: 1, body: [headers.map((text) => ({ text, bold: true, color: "#ffffff", fillColor: "#356445" })), ...rows] },
  layout: {
    hLineWidth: () => 0.5, vLineWidth: () => 0,
    hLineColor: () => "#e2e7dc",
    paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 8, paddingBottom: () => 8,
    fillColor: (row) => row > 0 && row % 2 === 0 ? "#f4f7f1" : null,
  },
  margin: [0, 8, 0, 18],
});
export async function generateReportPdf(report: ReportResult, filters: ReportFilters) {
  const summary = report.summary;
  const content: Content[] = [
    { text: "daymark.", fontSize: 13, bold: true, color: "#356445", margin: [0, 0, 0, 12] },
    { text: reportTypes[filters.type].title, fontSize: 24, bold: true, margin: [0, 0, 0, 5] },
    { text: "Generated " + new Date(report.generatedAt).toLocaleString("en-GB", { timeZone: filters.time_zone }), color: "#718067", margin: [0, 0, 0, 16] },
    { text: report.filters.join("  |  "), fontSize: 9, color: "#718067", margin: [0, 0, 0, 12] },
    table(["Total", "Open", "Under verification", "Blocked / dependent", "Completed", "Overdue"],
      [[summary.total, summary.open, summary.verification, summary.waiting, summary.completed, summary.overdue].map(String)], ["*", "*", "*", "*", "*", "*"]),
  ];
  if (filters.type === "status") content.push(
    { text: "Status breakdown", style: "section", headlineLevel: 1 },
    table(["Status", "Tasks", "Share"], summary.statusCounts.map((s) => [s.status, String(s.count), `${summary.total ? Math.round(s.count / summary.total * 100) : 0}%`]), ["*", 80, 80]),
  );
  if (filters.type === "workload" && report.rows.length) content.push(
    { text: "Workload by assignee", style: "section", headlineLevel: 1 },
    table(["Assignee / team", "Total", "Open", "Verification", "Waiting", "Completed", "Overdue"], summary.workload.map((s) => [s.name + (s.team !== s.name ? "\n" + s.team : ""), ...[s.total, s.open, s.verification, s.waiting, s.completed, s.overdue].map(String)]), ["*", 50, 50, 65, 50, 65, 50]),
  );
  if (!report.rows.length) content.push({ text: "No tasks match the selected filters.", margin: [0, 8, 0, 0], color: "#718067" });
  else if (["tasks", "overdue"].includes(filters.type) || filters.details === "yes") content.push(
    { text: "Task details", style: "section", headlineLevel: 1 },
    table(["Task", "Project / module", "Status", "Assignee", "Priority", "Target date"], report.rows.map((row) => [
      { text: row.title, bold: true },
      row.project_name + "\n" + row.module_name,
      row.status,
      row.assignee_name + (row.team_name !== "No team" && row.team_name !== row.assignee_name ? "\n" + row.team_name : ""),
      row.priority,
      { text: (row.target_date || "Not set") + (row.overdue ? "\nOverdue" : ""), color: row.overdue ? "#b45309" : "#33402d" },
    ]), ["*", 110, 92, 100, 42, 66]),
  );
  const dependencies = report.rows.filter((row) => row.dependency_reason);
  if (dependencies.length && (["tasks", "overdue"].includes(filters.type) || filters.details === "yes")) {
    content.push({ text: "Dependencies", style: "section", headlineLevel: 1 });
    for (const row of dependencies) content.push({
      unbreakable: row.dependency_reason!.split("\n").length <= 8,
      stack: [
        { text: row.title.replace(/\s+/g, " "), bold: true, margin: [0, 8, 0, 4] },
        { text: row.dependency_reason!, margin: [0, 0, 0, 12] },
      ],
    });
  }
  const definition: TDocumentDefinitions = {
    pageBreakBefore: (node, container) => !!node.headlineLevel && (container.getFollowingNodesOnPage().length === 0 || node.startPosition.verticalRatio > 0.8),
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [36, 36, 36, 42],
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#33402d" },
    styles: { section: { fontSize: 14, bold: true, margin: [0, 6, 0, 4] } },
    info: { title: reportTypes[filters.type].title, author: "Daymark" },
    footer: (page, pages) => ({ text: `Daymark  |  ${report.total} tasks  |  Page ${page} of ${pages}`, alignment: "right", color: "#718067", fontSize: 8, margin: [36, 12, 36, 0] }),
    content,
  };
  return pdfmake.createPdf(definition).getBuffer();
}
