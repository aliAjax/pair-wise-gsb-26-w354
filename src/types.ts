export type CounselorId = "A" | "B";

export type Category = "observation" | "risk" | "intervention" | "goal";

/** normal=一般内容；relative=涉及来访者亲属；third_party=涉及未经同意第三人 */
export type Sensitivity = "normal" | "relative" | "third_party";

export interface Counselor {
  id: CounselorId;
  name: string;
  title: string;
}

export interface CaseInfo {
  code: string;
  topic: string;
  sessionNo: string;
  sessionDate: string;
  mainConcern: string;
  emotionalState: string;
  riskLevel: string;
  nextGoal: string;
  counselors: Record<CounselorId, Counselor>;
}

/** 私密观察：仅作者本人可见 */
export interface Observation {
  id: string;
  authorId: CounselorId;
  category: Category;
  text: string;
  sensitivity: Sensitivity;
  /** 是否已取得当事人/监护人书面同意（敏感内容的放行依据） */
  consent: boolean;
  createdAt: number;
  /** 已点名分享后关联的草稿段落 id */
  draftId: string | null;
}

/** 共同草稿段落：点名分享后生成，需双方逐段确认 */
export interface DraftParagraph {
  id: string;
  observationId: string;
  authorId: CounselorId;
  category: Category;
  text: string;
  sensitivity: Sensitivity;
  consent: boolean;
  sharedAt: number;
  confirmed: Record<CounselorId, boolean>;
  /** 已并入某版正式纪要 */
  folded: boolean;
}

/** 正式纪要段落（快照文本，不随后续草稿变化） */
export interface MinutesParagraph {
  id: string;
  draftId: string;
  authorId: CounselorId;
  category: Category;
  text: string;
  sensitivity: Sensitivity;
  consent: boolean;
}

/** 正式纪要版本：每次生成或修订都完整留档 */
export interface MinutesVersion {
  version: number;
  createdAt: number;
  editorId: CounselorId;
  reason: string;
  paragraphs: MinutesParagraph[];
}

export interface SessionState {
  caseInfo: CaseInfo;
  observations: Observation[];
  drafts: DraftParagraph[];
  versions: MinutesVersion[];
}
