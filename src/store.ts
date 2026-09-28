import { useEffect, useMemo, useState } from "react";
import type {
  Category,
  CounselorId,
  DraftParagraph,
  MinutesParagraph,
  Observation,
  Sensitivity,
  SessionState,
} from "./types";
import { bothConfirmed, pendingDrafts, shareBlocked } from "./rules";
import { buildSeed } from "./seed";

const STORAGE_KEY = "hxwl-12-joint-session-v1";
const IDENTITY_KEY = "hxwl-12-active-counselor";

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function loadState(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionState;
      if (parsed && Array.isArray(parsed.observations)) return parsed;
    }
  } catch {
    /* 存储损坏时回退到示例数据 */
  }
  return buildSeed();
}

function loadIdentity(): CounselorId {
  return localStorage.getItem(IDENTITY_KEY) === "B" ? "B" : "A";
}

export function useSessionStore() {
  const [state, setState] = useState<SessionState>(loadState);
  const [identity, setIdentityState] = useState<CounselorId>(loadIdentity);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setIdentity = (id: CounselorId) => {
    setIdentityState(id);
    localStorage.setItem(IDENTITY_KEY, id);
  };

  const resetDemo = () => setState(buildSeed());

  /* ---------- 私密观察 ---------- */

  const addObservation = (input: {
    category: Category;
    text: string;
    sensitivity: Sensitivity;
    consent: boolean;
  }) => {
    const text = input.text.trim();
    if (!text) return;
    const obs: Observation = {
      id: uid("obs"),
      authorId: identity,
      category: input.category,
      text,
      sensitivity: input.sensitivity,
      consent: input.consent,
      createdAt: Date.now(),
      draftId: null,
    };
    setState((s) => ({ ...s, observations: [obs, ...s.observations] }));
  };

  const updateObservation = (
    id: string,
    patch: Partial<Pick<Observation, "text" | "sensitivity" | "consent" | "category">>
  ) => {
    setState((s) => ({
      ...s,
      observations: s.observations.map((o) =>
        o.id === id && o.authorId === identity && o.draftId === null
          ? { ...o, ...patch }
          : o
      ),
    }));
  };

  /** 点名分享：通过保密检查的观察进入共同草稿。返回阻止原因（null=成功） */
  const shareObservation = (id: string): string | null => {
    const obs = state.observations.find((o) => o.id === id);
    if (!obs || obs.authorId !== identity || obs.draftId) return "该观察不能分享";
    const blocked = shareBlocked(obs);
    if (blocked) return blocked;

    const draft: DraftParagraph = {
      id: uid("draft"),
      observationId: obs.id,
      authorId: obs.authorId,
      category: obs.category,
      text: obs.text,
      sensitivity: obs.sensitivity,
      consent: obs.consent,
      sharedAt: Date.now(),
      confirmed: { A: false, B: false },
      folded: false,
    };
    setState((s) => ({
      ...s,
      drafts: [draft, ...s.drafts],
      observations: s.observations.map((o) =>
        o.id === id ? { ...o, draftId: draft.id } : o
      ),
    }));
    return null;
  };

  /** 撤回分享：仅允许在尚未双方确认时由原作者收回私密区 */
  const withdrawDraft = (draftId: string) => {
    const d = state.drafts.find((x) => x.id === draftId);
    if (!d || d.folded || d.authorId !== identity || bothConfirmed(d)) return;
    setState((s) => ({
      ...s,
      drafts: s.drafts.filter((x) => x.id !== draftId),
      observations: s.observations.map((o) =>
        o.draftId === draftId ? { ...o, draftId: null } : o
      ),
    }));
  };

  /* ---------- 共同草稿 ---------- */

  const toggleConfirm = (draftId: string) => {
    setState((s) => ({
      ...s,
      drafts: s.drafts.map((d) =>
        d.id === draftId && !d.folded
          ? { ...d, confirmed: { ...d.confirmed, [identity]: !d.confirmed[identity] } }
          : d
      ),
    }));
  };

  /** 共同草稿文字可继续编辑，改动后双方确认全部清零、需重新确认 */
  const editDraftText = (draftId: string, text: string) => {
    setState((s) => ({
      ...s,
      drafts: s.drafts.map((d) =>
        d.id === draftId && !d.folded
          ? { ...d, text, confirmed: { A: false, B: false } }
          : d
      ),
    }));
  };

  /* ---------- 正式纪要 ---------- */

  /** 生成首版正式纪要：所有活动草稿必须双方确认 */
  const publishMinutes = (): string | null => {
    const active = state.drafts.filter((d) => !d.folded);
    if (active.length === 0) return "共同草稿中还没有可生成纪要的段落";
    const unconfirmed = active.filter((d) => !bothConfirmed(d));
    if (unconfirmed.length > 0)
      return `仍有 ${unconfirmed.length} 段未经双方确认，不能生成正式纪要`;

    const paragraphs: MinutesParagraph[] = active.map((d) => ({
      id: uid("mp"),
      draftId: d.id,
      authorId: d.authorId,
      category: d.category,
      text: d.text,
      sensitivity: d.sensitivity,
      consent: d.consent,
    }));
    setState((s) => ({
      ...s,
      drafts: s.drafts.map((d) => (d.folded ? d : { ...d, folded: true })),
      versions: [
        ...s.versions,
        {
          version: s.versions.length + 1,
          createdAt: Date.now(),
          editorId: identity,
          reason: "首次生成正式纪要：全部段落经两位咨询师逐段确认",
          paragraphs,
        },
      ],
    }));
    return null;
  };

  /** 修订正式纪要：必须填写修改原因；新并入草稿需已双方确认 */
  const reviseMinutes = (input: {
    keptIds: string[];
    texts: Record<string, string>;
    reason: string;
  }): string | null => {
    const reason = input.reason.trim();
    if (!reason) return "请先填写修改原因";
    const current = state.versions[state.versions.length - 1];
    if (!current) return "正式纪要尚未生成";
    const newcomers = state.drafts.filter((d) => !d.folded);
    const unconfirmed = newcomers.filter((d) => !bothConfirmed(d));
    if (unconfirmed.length > 0)
      return `新增段落中仍有 ${unconfirmed.length} 段未经双方确认`;

    const kept: MinutesParagraph[] = current.paragraphs.filter((p) =>
      input.keptIds.includes(p.id)
    ).map((p) => ({ ...p, text: input.texts[p.id]?.trim() || p.text }));
    const added: MinutesParagraph[] = newcomers.map((d) => ({
      id: uid("mp"),
      draftId: d.id,
      authorId: d.authorId,
      category: d.category,
      text: d.text,
      sensitivity: d.sensitivity,
      consent: d.consent,
    }));
    setState((s) => ({
      ...s,
      drafts: s.drafts.map((d) => (d.folded ? d : { ...d, folded: true })),
      versions: [
        ...s.versions,
        {
          version: s.versions.length + 1,
          createdAt: Date.now(),
          editorId: identity,
          reason,
          paragraphs: [...kept, ...added],
        },
      ],
    }));
    return null;
  };

  const counts = useMemo(() => {
    const activeDrafts = state.drafts.filter((d) => !d.folded);
    return {
      privateMine: state.observations.filter((o) => o.authorId === identity && !o.draftId).length,
      pending: pendingDrafts(state.drafts).length,
      activeDrafts: activeDrafts.length,
      confirmed: activeDrafts.filter(bothConfirmed).length,
      versions: state.versions.length,
    };
  }, [state, identity]);

  return {
    state,
    identity,
    setIdentity,
    resetDemo,
    addObservation,
    updateObservation,
    shareObservation,
    withdrawDraft,
    toggleConfirm,
    editDraftText,
    publishMinutes,
    reviseMinutes,
    counts,
  };
}
