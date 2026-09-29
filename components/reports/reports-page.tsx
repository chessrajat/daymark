"use client";
import { useEffect, useState } from "react";
import { Download, FileBarChart, Loader2, RotateCcw } from "lucide-react";
import { useWorkspace } from "@/lib/store";
import { localDay, statuses } from "@/lib/types";
import { reportSchema, reportTypes, type ReportFilters, type ReportResult } from "@/lib/reports";
import { WorkspaceSidebar } from "@/components/workspace/sidebar";
import { WorkspaceTopbar } from "@/components/workspace/topbar";
import { CreateModal } from "@/components/workspace/create-modal";
import { Button } from "@/components/ui/button";
const defaults = () => reportSchema.parse({ today: localDay(), time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone });

export function ReportsPage() {
  const s = useWorkspace((s) => s);
  const [filters, setFilters] = useState<ReportFilters>(defaults);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => { setFilters(defaults()); void s.refresh(); }, []);
  useEffect(() => {
    if (s.loading) return;
    const controller = new AbortController();
    setResult(null);
    setLoading(true);
    setError("");
    const parsed = reportSchema.safeParse(filters);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/reports?" + new URLSearchParams(filters), { signal: controller.signal });
        if (response.status === 401) { window.location.assign("/login"); return; }
        const report = await response.json();
        if (!response.ok) throw Error(report.error);
        if (!controller.signal.aborted) setResult(report);
      } catch (error) {
        if (!controller.signal.aborted) setError((error as Error).message);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, s.loading, retry]);
  function update(key: keyof ReportFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "project" ? { module: "" } : {}), ...(key === "type" ? { due: value === "overdue" ? "overdue" : current.type === "overdue" ? "" : current.due } : {}) }));
  }
  const select = (key: keyof ReportFilters, label: string, options: [string, string][]) => (
    <label key={key}>{label}
      <select disabled={key === "due" && filters.type === "overdue"} value={filters[key]} onChange={(event) => update(key, event.target.value)}>
        {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select>
    </label>
  );
  async function download() {
    if (!result || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reports?" + new URLSearchParams({ ...filters, format: "pdf" }));
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (!response.ok) throw Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `daymark-${filters.type}-${filters.today}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="shell">
      <WorkspaceSidebar s={s} section="reports" today={s.data.tasks.filter((t) => t.my_days.includes(filters.today))} setModal={setModal} />
      <main>
        <WorkspaceTopbar s={s} section="reports" />
        <div className="page reports-page">
          <div className="page-heading">
            <div><h1>Task reports</h1><p className="subtitle">Turn your task data into a clear, shareable PDF.</p></div>
            <Button onClick={download} disabled={busy || loading || !result}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {busy ? "Generating PDF…" : "Download PDF"}
            </Button>
          </div>
          <section className="report-panel" aria-labelledby="report-setup-heading">
            <div className="section-heading"><h2 id="report-setup-heading">Build your report</h2>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setFilters(defaults())}><RotateCcw size={14} /> Reset filters</Button>
            </div>
            <fieldset disabled={busy} className="report-filters">
              <legend className="sr-only">Report type and task filters</legend>
              {select("type", "Report type", Object.entries(reportTypes).map(([key, report]) => [key, report.title]))}
              {select("status", "Status", [["not-completed", "Not completed"], ["all", "All statuses"], ...statuses.map((value): [string, string] => [value, value])])}
              {select("project", "Project", [["", "All projects"], ...s.data.projects.map((p): [string, string] => [p.id, p.name])])}
              {select("module", "Module", [["", "All modules"], ["none", "No module"], ...s.data.modules.filter((m) => !filters.project || m.project_id === filters.project).map((m): [string, string] => [m.id, m.name])])}
              {select("member", "Assignee", [["", "All members"], ["none", "No member assigned"], ...s.data.members.map((m): [string, string] => [m.id, m.name])])}
              {select("team", "Team", [["", "All teams"], ["none", "No team"], ...s.data.teams.map((t): [string, string] => [t.id, t.name])])}
              {select("assignment", "Assignment", [["", "All assignments"], ["unassigned", "Unassigned tasks"]])}
              {select("priority", "Priority", [["", "All priorities"], ["High", "High"], ["Medium", "Medium"], ["Low", "Low"]])}
              {select("due", "Target date", [["", "Any target date"], ["overdue", "Overdue"], ["today", "Due today"], ["undated", "No target date"]])}
              {select("date_field", "Date range applies to", [["target", "Target date"], ["created", "Created date"], ["updated", "Last updated date"]])}
              <label>From<input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update("from", event.target.value)} /></label>
              <label>To<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update("to", event.target.value)} /></label>
              <label>My Day<input type="date" value={filters.my_day} onChange={(event) => update("my_day", event.target.value)} /></label>
              {select("sort", "Sort by", [["target", "Target date (earliest first)"], ["created", "Newest first"], ["title", "Task name"], ["status", "Status"], ["assignee", "Assignee"]])}
              <label className="report-search">Search tasks<input type="search" placeholder="Task title or description" value={filters.query} maxLength={200} onChange={(event) => update("query", event.target.value)} /></label>
              {["status", "workload"].includes(filters.type) && <label className="report-check"><input type="checkbox" checked={filters.details === "yes"} onChange={(event) => update("details", event.target.checked ? "yes" : "no")} /> Include task details in the PDF</label>}
            </fieldset>
            <p className="report-hint">{reportTypes[filters.type].description} {filters.type === "overdue" && "Completed and dropped tasks are excluded."}</p>
          </section>
          {(error || s.error) && <div role="alert" className="error">{error || s.error} <Button variant="ghost" size="sm" onClick={() => { setRetry((value) => value + 1); if (s.error) void s.refresh(); }}>Retry</Button></div>}
          {loading ? <div className="empty" role="status"><Loader2 className="animate-spin" /> Generating preview…</div> : result && <>
            <div className="report-metrics" aria-label="Report totals">
              {[["Tasks", result.summary.total], ["Open", result.summary.open], ["Under verification", result.summary.verification], ["Blocked / dependent", result.summary.waiting], ["Completed", result.summary.completed], ["Overdue", result.summary.overdue]].map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}
            </div>
            {filters.type === "status" && <section className="report-panel"><h2>Status breakdown</h2><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Status</th><th>Tasks</th><th>Share</th></tr></thead><tbody>
              {result.summary.statusCounts.map((item) => <tr key={item.status}><td>{item.status}</td><td>{item.count}</td><td>{result.total ? Math.round(item.count / result.total * 100) : 0}%</td></tr>)}
            </tbody></table></div></section>}
            {filters.type === "workload" && result.total > 0 && <section className="report-panel"><h2>Workload by assignee</h2><div className="report-table-wrap"><table className="report-table"><thead><tr>{["Assignee", "Total", "Open", "Verification", "Waiting", "Completed", "Overdue"].map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody>
              {result.summary.workload.map((item, index) => <tr key={index}><td>{item.name}<small>{item.team}</small></td><td>{item.total}</td><td>{item.open}</td><td>{item.verification}</td><td>{item.waiting}</td><td>{item.completed}</td><td>{item.overdue}</td></tr>)}
            </tbody></table></div></section>}
            <section className="report-panel">
              <div className="section-heading"><h2>Task preview <span>{result.total}</span></h2><span className="report-hint">{result.rows.length < result.total ? `First ${result.rows.length} tasks shown; the PDF includes all ${result.total}.` : "The PDF includes all matching tasks."}</span></div>
              {!result.total ? <div className="empty"><FileBarChart size={28} /><h3>No matching tasks</h3><p>Try broadening your filters.</p></div> : <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Task</th><th>Project / module</th><th>Status</th><th>Assignee</th><th>Priority</th><th>Target date</th></tr></thead><tbody>
                {result.rows.map((row) => <tr key={row.id}><td>{row.title}{row.dependency_reason && <details className="report-dependency"><summary>Dependency reason</summary><small>{row.dependency_reason}</small></details>}</td><td>{row.project_name}<small>{row.module_name}</small></td><td>{row.status}</td><td>{row.assignee_name}<small>{row.team_name}</small></td><td>{row.priority}</td><td className={row.overdue ? "report-overdue" : ""}>{row.target_date || "Not set"}{row.overdue && <small>Overdue</small>}</td></tr>)}
              </tbody></table></div>}
            </section>
          </>}
        </div>
      </main>
      <CreateModal kind={modal} close={() => setModal(null)} day={filters.today} />
    </div>
  );
}
