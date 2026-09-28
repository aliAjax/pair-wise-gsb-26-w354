import type {
  Category,
  CounselorId,
  DraftParagraph,
  Observation,
  Sensitivity,
} from "./types";

export const COUNSELOR_IDS: CounselorId[] = ["A", "B"];
export const BOTH = COUNSELOR_IDS;

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  observation: { label: "观察", color: "#7c3aed" },
  risk: { label: "风险", color: "#e11d48" },
  intervention: { label: "干预", color: "#0f766e" },
  goal: { label: "目标", color: "#d97706" },
};

export const SENSITIVITY_META: Record<
  Sensitivity,
  { label: string; short: string; reason: string }
> = {
  normal: {
    label: "一般内容",
    short: "一般",
    reason: "一般会谈内容，可进入正式摘要",
  },
  relative: {
    label: "涉及来访者亲属",
    short: "亲属",
    reason: "涉及来访者亲属的第三方信息，未取得授权，不进入对外正式摘要",
  },
  third_party: {
    label: "涉及未经同意第三人",
    short: "第三人",
    reason: "涉及未经本人同意的第三方信息，依保密与最小必要原则过滤",
  },
};

/** 敏感且未取得同意时，锁定在私密区，不能点名分享 */
export function shareBlocked(o: Observation): string | null {
  if (!o.text.trim()) return "内容为空";
  if (o.sensitivity !== "normal" && !o.consent) {
    return o.sensitivity === "relative"
      ? "涉及来访者亲属且未取得同意，不能分享"
      : "涉及未经同意第三人，不能分享";
  }
  return null;
}

/** 导出正式摘要时是否保留该段 */
export function exportAllowed(
  p: { sensitivity: Sensitivity; consent: boolean }
): boolean {
  return p.sensitivity === "normal" || p.consent;
}

export function exportReason(p: { sensitivity: Sensitivity }): string {
  return SENSITIVITY_META[p.sensitivity].reason;
}

export function bothConfirmed(p: {
  confirmed: Record<CounselorId, boolean>;
}): boolean {
  return p.confirmed.A && p.confirmed.B;
}

export function pendingDrafts(drafts: DraftParagraph[]): DraftParagraph[] {
  return drafts.filter((d) => !d.folded && !bothConfirmed(d));
}
