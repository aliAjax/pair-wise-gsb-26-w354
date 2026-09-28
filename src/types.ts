export type CounselorId = "A" | "B";

/** 私密标记：涉及来访者亲属，或未经同意的第三人 */
export type SensitiveCategory = "relative" | "thirdparty";

/** 咨询师个人观察：默认仅作者可见 */
export interface Observation {
  id: string;
  authorId: CounselorId;
  createdAt: number;
  updatedAt: number;
  content: string;
  /** null 表示普通观察；非空则强制留在私密区，不能分享 */
  sensitive: SensitiveCategory | null;
  /** 点名分享后生成的共同草稿段 id；null 表示尚未分享 */
  sharedDraftId: string | null;
}

/** 共同草稿段：由某位观察作者点名分享进入，双方确认后才可进入正式纪要 */
export interface DraftParagraph {
  id: string;
  sourceObservationId: string;
  sharedById: CounselorId;
  createdAt: number;
  updatedAt: number;
  content: string;
  confirmedA: boolean;
  confirmedB: boolean;
  status: "pending" | "confirmed";
  confirmedAt: number | null;
}

/** 正式纪要版本：任何改动都新增不可变版本，记录原因、时间与操作人 */
export interface MinutesVersion {
  version: number;
  createdAt: number;
  editorId: CounselorId;
  /** null = 首次生成；非空 = 本次改动/回退的原因 */
  changeReason: string | null;
  paragraphs: string[];
  basedOnDraftIds: string[];
}

export interface SessionState {
  clientCode: string;
  topic: string;
  sessionDate: string;
  observations: Observation[];
  drafts: DraftParagraph[];
  minutesVersions: MinutesVersion[];
  currentMinutesVersion: number | null;
  updatedAt: number;
}

/** 导出时被过滤条目的台账记录 */
export interface FilterEntry {
  group: "sensitive" | "unshared" | "draft-pending";
  content: string;
  reason: string;
}
