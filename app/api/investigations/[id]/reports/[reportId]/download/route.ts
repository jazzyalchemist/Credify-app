import { getReport } from "@/lib/db/reports";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; reportId: string }> },
) {
  const { id, reportId } = await context.params;
  const report = await getReport(id, reportId);

  if (!report) {
    return new Response("Report not found.", { status: 404 });
  }

  const filename =
    "credify-" +
    id.replace(/[^a-zA-Z0-9-_]/g, "_") +
    "-" +
    report.stage.toLowerCase().replaceAll("_", "-") +
    ".md";

  return new Response(report.markdown_content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
      "X-Credify-SHA256": report.sha256,
    },
  });
}
