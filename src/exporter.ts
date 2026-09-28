import type { CaseInfo, MinutesVersion } from "./types";
import { CATEGORY_META, exportAllowed, exportReason } from "./rules";

export interface ExportLine {
  no: number;
  category: string;
  text: string;
  kept: boolean;
  reason: string;
}

/** 按最新版正式纪要逐条判定：敏感且未授权段落过滤并说明原因 */
export function buildExportLines(version: MinutesVersion | undefined): ExportLine[] {
  if (!version) return [];
  return version.paragraphs.map((p, i) => {
    const kept = exportAllowed(p);
    return {
      no: i + 1,
      category: CATEGORY_META[p.category].label,
      text: p.text,
      kept,
      reason: kept
        ? "一般会谈内容（或已取得授权），纳入摘要"
        : exportReason(p),
    };
  });
}

export function buildSummaryText(c: CaseInfo, v: MinutesVersion, lines: ExportLine[]): string {
  const stamp = new Date(v.createdAt).toLocaleString("zh-CN", { hour12: false });
  const kept = lines.filter((l) => l.kept);
  const dropped = lines.filter((l) => !l.kept);
  const rows = kept.map((l) => `${l.no}. [${l.category}] ${l.text}`).join("\n");
  const filtered = dropped
    .map((l) => `第 ${l.no} 条 [${l.category}] 已过滤：${l.reason}`)
    .join("\n");
  return [
    "联合会谈正式摘要（对外导出）",
    `个案代号：${c.code}　咨询主题：${c.topic}`,
    `场次：${c.sessionNo}　会谈日期：${c.sessionDate}`,
    `主接：${c.counselors.A.name}　协同：${c.counselors.B.name}`,
    `依据纪要版本：v${v.version}　生成时间：${stamp}`,
    "",
    "【纳入摘要的内容】",
    kept.length ? rows : "（无）",
    "",
    "【已过滤段落及原因】",
    dropped.length ? filtered : "无（本版全部段落均符合对外披露要求）",
    "",
    `共 ${lines.length} 条，纳入 ${kept.length} 条，过滤 ${dropped.length} 条。`,
  ].join("\n");
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
