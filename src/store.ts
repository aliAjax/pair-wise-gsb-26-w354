import type {
  CounselorId,
  DraftParagraph,
  FilterEntry,
  MinutesVersion,
  Observation,
  SensitiveCategory,
  SessionState,
} from "./types";

const STORAGE_KEY = "hxwl-12-joint-session-v1";

export const COUNSELORS: Record<CounselorId, { name: string; role: string }> = {
  A: { name: "咨询师甲", role: "主谈咨询师" },
  B: { name: "咨询师乙", role: "协同咨询师" },
};

export const SENSITIVE_LABELS: Record<SensitiveCategory, { label: string; reason: string }> = {
  relative: {
    label: "涉及来访者亲属",
    reason: "涉及来访者亲属的内容，属敏感个人信息，未经授权不得进入共享纪要与对外摘要。",
  },
  thirdparty: {
    label: "涉及未经同意第三人",
    reason: "涉及未取得信息使用同意的第三方，依据保密原则不得进入共享纪要与对外摘要。",
  },
};

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function isBothConfirmed(p: DraftParagraph): boolean {
  return p.confirmedA && p.confirmedB;
}

/* ---------------- 演示数据 ---------------- */

function seedState(): SessionState {
  const base = new Date("2026-09-28T09:30:00").getTime();
  const minute = 60_000;

  const obs: Observation[] = [
    {
      id: "obs-seed-1",
      authorId: "A",
      createdAt: base + 8 * minute,
      updatedAt: base + 8 * minute,
      content:
        "来访者谈到本周睡眠略有改善，每晚可连续睡约 5 小时；情绪自评由 4 分升至 6 分（0-10）。愿意继续坚持腹式呼吸练习。",
      sensitive: null,
      sharedDraftId: "draft-seed-1",
    },
    {
      id: "obs-seed-2",
      authorId: "A",
      createdAt: base + 12 * minute,
      updatedAt: base + 12 * minute,
      content:
        "来访者母亲多次在电话中催促其回老家发展，来访者表现出明显回避与烦躁，挂断电话后沉默约两分钟。",
      sensitive: "relative",
      sharedDraftId: null,
    },
    {
      id: "obs-seed-3",
      authorId: "B",
      createdAt: base + 15 * minute,
      updatedAt: base + 15 * minute,
      content:
        "观察到来访者在谈工作议题时双手握拳、语速加快；使用 grounding（着陆技术）后，肩颈放松、呼吸趋缓。",
      sensitive: null,
      sharedDraftId: "draft-seed-2",
    },
    {
      id: "obs-seed-4",
      authorId: "B",
      createdAt: base + 20 * minute,
      updatedAt: base + 20 * minute,
      content:
        "来访者提到的同事姓名与其在部门冲突中的具体言行，来访者未授权在任何书面材料中出现。",
      sensitive: "thirdparty",
      sharedDraftId: null,
    },
    {
      id: "obs-seed-5",
      authorId: "A",
      createdAt: base + 26 * minute,
      updatedAt: base + 26 * minute,
      content:
        "会谈尾声共同商定：下周每日进行两次呼吸练习并记录睡眠；下次会谈聚焦职业边界议题。（待与乙核对措辞）",
      sensitive: null,
      sharedDraftId: "draft-seed-3",
    },
  ];

  const drafts: DraftParagraph[] = [
    {
      id: "draft-seed-1",
      sourceObservationId: "obs-seed-1",
      sharedById: "A",
      createdAt: base + 31 * minute,
      updatedAt: base + 31 * minute,
      content:
        "睡眠改善：每晚可连续睡约 5 小时；情绪自评 4 → 6 分（0-10）。来访者同意继续腹式呼吸练习。",
      confirmedA: true,
      confirmedB: true,
      status: "confirmed",
      confirmedAt: base + 40 * minute,
    },
    {
      id: "draft-seed-2",
      sourceObservationId: "obs-seed-3",
      sharedById: "B",
      createdAt: base + 33 * minute,
      updatedAt: base + 33 * minute,
      content:
        "谈工作时出现握拳、语速加快等紧张反应；运用着陆技术后躯体放松、呼吸趋缓，干预有效。",
      confirmedA: true,
      confirmedB: true,
      status: "confirmed",
      confirmedAt: base + 41 * minute,
    },
    {
      id: "draft-seed-3",
      sourceObservationId: "obs-seed-5",
      sharedById: "A",
      createdAt: base + 35 * minute,
      updatedAt: base + 35 * minute,
      content:
        "下周计划：每日两次呼吸练习并记录睡眠；下次会谈聚焦职业边界。（待乙确认措辞）",
      confirmedA: true,
      confirmedB: false,
      status: "pending",
      confirmedAt: null,
    },
  ];

  const v1: MinutesVersion = {
    version: 1,
    createdAt: base + 45 * minute,
    editorId: "A",
    changeReason: null,
    paragraphs: [drafts[0].content, drafts[1].content],
    basedOnDraftIds: ["draft-seed-1", "draft-seed-2"],
  };

  return {
    clientCode: "C-042",
    topic: "焦虑 / 职业压力",
    sessionDate: "2026-09-28",
    observations: obs,
    drafts,
    minutesVersions: [v1],
    currentMinutesVersion: 1,
    updatedAt: base + 45 * minute,
  };
}

export function loadState(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed.observations || !parsed.drafts || !parsed.minutesVersions) {
      throw new Error("bad cache");
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: SessionState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): SessionState {
  const seeded = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

/* ---------------- 领域操作 ---------------- */

export function addObservation(
  state: SessionState,
  authorId: CounselorId,
  content: string,
  sensitive: SensitiveCategory | null,
): SessionState {
  const now = Date.now();
  const o: Observation = {
    id: uid("obs"),
    authorId,
    createdAt: now,
    updatedAt: now,
    content: content.trim(),
    sensitive,
    sharedDraftId: null,
  };
  return { ...state, observations: [o, ...state.observations], updatedAt: now };
}

export function deleteObservation(state: SessionState, obsId: string): SessionState {
  const o = state.observations.find((x) => x.id === obsId);
  if (!o) return state;
  const draft = o.sharedDraftId
    ? state.drafts.find((d) => d.id === o.sharedDraftId)
    : undefined;
  if (draft && isBothConfirmed(draft)) {
    // 已进入正式纪要的观察，须先走正式纪要修订流程，不允许从源头直接删除
    return state;
  }
  const drafts = draft ? state.drafts.filter((d) => d.id !== draft.id) : state.drafts;
  return {
    ...state,
    observations: state.observations.filter((x) => x.id !== obsId),
    drafts,
    updatedAt: Date.now(),
  };
}

/** 点名分享：从个人观察复制一条进入共同草稿；分享人即视为本人已确认 */
export function shareObservation(state: SessionState, obsId: string): SessionState {
  const o = state.observations.find((x) => x.id === obsId);
  if (!o || o.sensitive || o.sharedDraftId) return state;
  const now = Date.now();
  const draft: DraftParagraph = {
    id: uid("draft"),
    sourceObservationId: o.id,
    sharedById: o.authorId,
    createdAt: now,
    updatedAt: now,
    content: o.content,
    confirmedA: o.authorId === "A",
    confirmedB: o.authorId === "B",
    status: "pending",
    confirmedAt: null,
  };
  return {
    ...state,
    drafts: [...state.drafts, draft],
    observations: state.observations.map((x) =>
      x.id === o.id ? { ...x, sharedDraftId: draft.id } : x,
    ),
    updatedAt: now,
  };
}

/** 撤回分享：草稿回到私密区（仅双方未全部确认时可撤回） */
export function withdrawDraft(state: SessionState, draftId: string): SessionState {
  const d = state.drafts.find((x) => x.id === draftId);
  if (!d || isBothConfirmed(d)) return state;
  return {
    ...state,
    drafts: state.drafts.filter((x) => x.id !== draftId),
    observations: state.observations.map((o) =>
      o.id === d.sourceObservationId ? { ...o, sharedDraftId: null } : o,
    ),
    updatedAt: Date.now(),
  };
}

export function toggleDraftConfirm(
  state: SessionState,
  draftId: string,
  counselor: CounselorId,
): SessionState {
  const now = Date.now();
  const drafts = state.drafts.map((d) => {
    if (d.id !== draftId) return d;
    const next = { ...d, updatedAt: now };
    if (counselor === "A") next.confirmedA = !d.confirmedA;
    else next.confirmedB = !d.confirmedB;
    if (next.confirmedA && next.confirmedB) {
      next.status = "confirmed";
      next.confirmedAt = d.confirmedAt ?? now;
    } else {
      next.status = "pending";
      next.confirmedAt = null;
    }
    return next;
  });
  return { ...state, drafts, updatedAt: now };
}

export function editDraftContent(
  state: SessionState,
  draftId: string,
  content: string,
): SessionState {
  // 任何一方编辑草稿都将使双方确认失效，需要重新确认
  const now = Date.now();
  const drafts = state.drafts.map((d) =>
    d.id === draftId
      ? {
          ...d,
          content: content.trim(),
          updatedAt: now,
          confirmedA: false,
          confirmedB: false,
          status: "pending" as const,
          confirmedAt: null,
        }
      : d,
  );
  return { ...state, drafts, updatedAt: now };
}

/** 双方确认后生成 / 更新正式纪要；已存在正式纪要时必须填写修改原因 */
export function generateMinutes(state: SessionState, editorId: CounselorId, reason: string): SessionState {
  const confirmed = state.drafts.filter(isBothConfirmed);
  if (confirmed.length === 0) return state;
  if (state.minutesVersions.length > 0 && !reason.trim()) return state;

  const now = Date.now();
  const version = (state.currentMinutesVersion ?? 0) + 1;
  const v: MinutesVersion = {
    version,
    createdAt: now,
    editorId,
    changeReason: state.minutesVersions.length === 0 ? null : reason.trim(),
    paragraphs: confirmed.map((d) => d.content),
    basedOnDraftIds: confirmed.map((d) => d.id),
  };
  return {
    ...state,
    minutesVersions: [...state.minutesVersions, v],
    currentMinutesVersion: version,
    updatedAt: now,
  };
}

/** 直接修订当前正式纪要：保存旧版本、修改原因与时间 */
export function editMinutes(
  state: SessionState,
  editorId: CounselorId,
  paragraphs: string[],
  reason: string,
): SessionState {
  if (state.currentMinutesVersion === null || !reason.trim()) return state;
  const cleaned = paragraphs.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length === 0) return state;

  const now = Date.now();
  const version = state.currentMinutesVersion + 1;
  const v: MinutesVersion = {
    version,
    createdAt: now,
    editorId,
    changeReason: reason.trim(),
    paragraphs: cleaned,
    basedOnDraftIds: state.drafts.filter(isBothConfirmed).map((d) => d.id),
  };
  return {
    ...state,
    minutesVersions: [...state.minutesVersions, v],
    currentMinutesVersion: version,
    updatedAt: now,
  };
}

/** 回退到历史版本：历史不可改，回退本身生成新版本并记录原因 */
export function restoreMinutes(
  state: SessionState,
  editorId: CounselorId,
  targetVersion: number,
  reason: string,
): SessionState {
  const target = state.minutesVersions.find((v) => v.version === targetVersion);
  if (!target || !reason.trim()) return state;
  const now = Date.now();
  const version = (state.currentMinutesVersion ?? 0) + 1;
  const v: MinutesVersion = {
    ...target,
    version,
    createdAt: now,
    editorId,
    changeReason: `回退至 v${targetVersion}：${reason.trim()}`,
  };
  return {
    ...state,
    minutesVersions: [...state.minutesVersions, v],
    currentMinutesVersion: version,
    updatedAt: now,
  };
}

/* ---------------- 导出：逐条过滤并说明原因 ---------------- */

export function buildFilterLedger(state: SessionState, viewer: CounselorId): FilterEntry[] {
  const entries: FilterEntry[] = [];

  // 1) 共同草稿中尚未经双方确认的段落
  state.drafts
    .filter((d) => !isBothConfirmed(d))
    .forEach((d) => {
      entries.push({
        group: "draft-pending",
        content: d.content,
        reason: `该段仍为共同草稿待确认段（甲${d.confirmedA ? "✓" : "✗"} / 乙${d.confirmedB ? "✓" : "✗"}），未经双方确认，不得进入正式摘要。`,
      });
    });

  // 2) 敏感观察：来访者亲属 / 未经同意第三人——强制留在私密区
  state.observations
    .filter((o) => o.sensitive)
    .forEach((o) => {
      const own = o.authorId === viewer;
      entries.push({
        group: "sensitive",
        content: own ? o.content : "（另一位咨询师的私密观察，内容不可见）",
        reason: own
          ? SENSITIVE_LABELS[o.sensitive as SensitiveCategory].reason
          : `${SENSITIVE_LABELS[o.sensitive as SensitiveCategory].label}内容，仅作者本人可见；对其本人之外不展示原文。`,
      });
    });

  // 3) 普通但尚未点名分享的个人观察
  state.observations
    .filter((o) => !o.sensitive && !o.sharedDraftId)
    .forEach((o) => {
      const own = o.authorId === viewer;
      entries.push({
        group: "unshared",
        content: own ? o.content : "（另一位咨询师的私密观察，内容不可见）",
        reason: own
          ? "该观察尚未由作者点名分享，仍属个人私密笔记，不进入共同纪要与对外摘要。"
          : "另一位咨询师尚未点名分享的个人观察，内容仅其本人可见。",
      });
    });

  return entries;
}

export function buildExportText(state: SessionState): string {
  const v = state.minutesVersions.find((x) => x.version === state.currentMinutesVersion);
  const lines: string[] = [];
  lines.push("联合会谈正式摘要");
  lines.push("=".repeat(24));
  lines.push(`来访者代号：${state.clientCode}`);
  lines.push(`咨询主题：${state.topic}`);
  lines.push(`会谈日期：${state.sessionDate}`);
  if (v) {
    lines.push(`纪要版本：v${v.version}（${formatTime(v.createdAt)}，${COUNSELORS[v.editorId].name}${v.changeReason ? `；修订：${v.changeReason}` : ""}）`);
  }
  lines.push("");
  lines.push("一、正式摘要内容（仅收录双方已确认段落）");
  lines.push("-".repeat(24));
  if (v && v.paragraphs.length > 0) {
    v.paragraphs.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  } else {
    lines.push("（尚无双方确认并生成的正式纪要）");
  }
  return lines.join("\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob(["﻿" + text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
