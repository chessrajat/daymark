import { authGuard } from "@/lib/auth";
import { reportSchema, summarizeReport, type ReportResult } from "@/lib/reports";
import { loadReport } from "@/lib/report-query";
import { generateReportPdf } from "@/lib/report-pdf";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const denied = await authGuard(req);
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const format = params.get("format") || "json";
  if (!["json", "pdf"].includes(format)) return Response.json({ error: "Choose PDF or preview format." }, { status: 400 });
  const parsed = reportSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const { rows, labels } = await loadReport(parsed.data);
    const report: ReportResult = { rows, summary: summarizeReport(rows), filters: labels, generatedAt: new Date().toISOString(), total: rows.length };
    if (format === "json") return Response.json({ ...report, rows: rows.slice(0, 100) }, { headers: { "Cache-Control": "no-store" } });
    const pdf = await generateReportPdf(report, parsed.data);
    return new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="daymark-${parsed.data.type}-${parsed.data.today}.pdf"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if ((error as Error).message.includes("exceeds 5,000")) return Response.json({ error: (error as Error).message }, { status: 422 });
    console.error(error);
    return Response.json({ error: "Could not generate the report. Please try again." }, { status: 503 });
  }
}
