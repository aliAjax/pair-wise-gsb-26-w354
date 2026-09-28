import { useState } from "react";
import "./styles.css";
import { useSessionStore } from "./store";
import {
  BOTH,
  CATEGORY_META,
  SENSITIVITY_META,
  bothConfirmed,
  shareBlocked,
} from "./rules";
import type {
  Category,
  CounselorId,
  DraftParagraph,
  MinutesVersion,
  Observation,
  Sensitivity,
} from "./types";
import { buildExportLines, buildSummaryText, downloadText } from "./exporter";

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtFull(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

const COUNSELOR_COLOR: Record<CounselorId, string> = {
  A: "#7c3aed",
  B: "#0f766e",
};

function App() {
  const store = useSessionStore();
  const { state, identity } = store;
  const me = state.caseInfo.counselors[identity];
  const other = state.caseInfo.counselors[identity === "A" ? "B" : "A"];
  const [notice, setNotice] = useState<string | null>(null);

  const activeDrafts = state.drafts.filter((d) => !d.folded);
  const foldedDrafts = state.drafts.filter((d) => d.folded);
  const latest: MinutesVersion | undefined =
    state.versions.length > 0 ? state.versions[state.versions.length - 1] : undefined;

  const flash = (msg: string | null) => {
    setNotice(msg);
    if (msg) window.setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 3600);
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{state.caseInfo.code} · 联合会谈记录台</p>
          <h1>双咨询师联合会谈记录</h1>
          <p className="subtitle">
            各自写私密观察，点名分享进入共同草稿，双方逐段确认后生成正式纪要；
            涉及亲属或未经同意第三人的内容留在私密区，导出时逐条过滤并说明原因。
          </p>
        </div>
        <IdentitySwitch
          me={identity}
          names={state.caseInfo.counselors}
          onSwitch={store.setIdentity}
          onReset={store.resetDemo}
        />
      </section>

      <CaseStrip state={state} />

      <section className="metrics-grid">
        <MetricCard label="我的私密观察（仅自己可见）" value={String(store.counts.privateMine)} tone="A" />
        <MetricCard
          label="待确认段落（重开仍保留）"
          value={String(store.counts.pending)}
          tone={store.counts.pending > 0 ? "warn" : "ok"}
        />
        <MetricCard
          label="草稿确认进度"
          value={`${store.counts.confirmed}/${store.counts.activeDrafts}`}
          tone="B"
        />
        <MetricCard label="正式纪要版本" value={latest ? `v${latest.version}` : "—"} tone="ok" />
      </section>

      {store.counts.pending > 0 && (
        <div className="pending-banner" role="status">
          有 {store.counts.pending} 段共同草稿尚未经双方确认，已随本场会谈保存在本机，重新打开页面仍可继续确认。
        </div>
      )}
      {notice && (
        <div className="notice-banner" role="alert">
          {notice}
        </div>
      )}

      <section className="workspace joint">
        <PrivateZone
          state={state}
          me={identity}
          onAdd={store.addObservation}
          onUpdate={store.updateObservation}
          onShare={(id) => flash(store.shareObservation(id))}
          otherName={other.name}
        />
        <DraftZone
          state={state}
          me={identity}
          drafts={activeDrafts}
          onToggle={store.toggleConfirm}
          onEditText={store.editDraftText}
          onWithdraw={store.withdrawDraft}
          onPublish={() => flash(store.publishMinutes())}
          hasMinutes={Boolean(latest)}
        />
      </section>

      <MinutesPanel
        state={state}
        me={identity}
        latest={latest}
        foldedCount={foldedDrafts.length}
        activeDrafts={activeDrafts}
        onRevise={(input) => {
          const err = store.reviseMinutes(input);
          flash(err);
          return err;
        }}
      />
    </main>
  );
}

/* ---------------- 身份切换 ---------------- */

function IdentitySwitch({
  me,
  names,
  onSwitch,
  onReset,
}: {
  me: CounselorId;
  names: Record<CounselorId, { id: CounselorId; name: string; title: string }>;
  onSwitch: (id: CounselorId) => void;
  onReset: () => void;
}) {
  return (
    <div className="stack-card identity-card">
      <span>当前身份（同机双角色演示）</span>
      <div className="identity-switch">
        {BOTH.map((id) => (
          <button
            key={id}
            className={me === id ? "id-btn active" : "id-btn"}
            style={me === id ? { borderColor: COUNSELOR_COLOR[id], background: `${COUNSELOR_COLOR[id]}14` } : undefined}
            onClick={() => onSwitch(id)}
          >
            <i className="dot" style={{ background: COUNSELOR_COLOR[id] }} />
            <strong>{names[id].name}</strong>
            <small>{names[id].title}</small>
          </button>
        ))}
      </div>
      <button className="ghost-btn" onClick={onReset}>
        重置为示例数据
      </button>
    </div>
  );
}

/* ---------------- 个案信息 ---------------- */

function CaseStrip({ state }: { state: ReturnType<typeof useSessionStore>["state"] }) {
  const c = state.caseInfo;
  const items: Array<[string, string]> = [
    ["咨询主题", c.topic],
    ["会谈场次", c.sessionNo],
    ["会谈日期", c.sessionDate],
    ["主要困扰", c.mainConcern],
    ["情绪状态", c.emotionalState],
    ["风险等级", c.riskLevel],
    ["下次目标", c.nextGoal],
  ];
  return (
    <section className="panel case-strip">
      <div className="case-head">
        <h2>个案 {c.code}</h2>
        <p>
          <span className="therapist-tag" style={{ color: COUNSELOR_COLOR.A }}>
            主接 · {c.counselors.A.name}
          </span>
          <span className="therapist-tag" style={{ color: COUNSELOR_COLOR.B }}>
            协同 · {c.counselors.B.name}
          </span>
        </p>
      </div>
      <div className="case-fields">
        {items.map(([k, v]) => (
          <div key={k} className="case-field">
            <span>{k}</span>
            <p>{v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "A" | "B" | "ok" | "warn";
}) {
  const bar = { A: "#7c3aed", B: "#0f766e", ok: "#0f766e", warn: "#f59e0b" }[tone];
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i style={{ background: bar }} />
    </article>
  );
}

/* ---------------- 私密观察区 ---------------- */

function PrivateZone(props: {
  state: ReturnType<typeof useSessionStore>["state"];
  me: CounselorId;
  onAdd: ReturnType<typeof useSessionStore>["addObservation"];
  onUpdate: ReturnType<typeof useSessionStore>["updateObservation"];
  onShare: (id: string) => void;
  otherName: string;
}) {
  const { state, me } = props;
  const mine = state.observations.filter((o) => o.authorId === me);
  const unshared = mine.filter((o) => !o.draftId);
  const shared = mine.filter((o) => o.draftId);

  return (
    <section className="panel zone private-zone">
      <div className="zone-head">
        <div>
          <p className="zone-kicker" style={{ color: COUNSELOR_COLOR[me] }}>
            仅 {state.caseInfo.counselors[me].name} 可见
          </p>
          <h2>① 私密观察区</h2>
        </div>
        <span className="lock-hint">🔒 内容保存在本机，对方无法查看</span>
      </div>

      <ObservationForm me={me} onAdd={props.onAdd} />

      <div className="obs-list">
        {unshared.map((o) => (
          <ObservationCard key={o.id} obs={o} me={me} onUpdate={props.onUpdate} onShare={props.onShare} />
        ))}
        {unshared.length === 0 && <p className="empty-hint">暂无私密观察，可在上方记录。</p>}
      </div>

      {shared.length > 0 && (
        <details className="shared-fold">
          <summary>我已点名分享的观察（{shared.length}）</summary>
          {shared.map((o) => {
            const d = state.drafts.find((x) => x.id === o.draftId);
            const status = !d
              ? "已分享"
              : d.folded
                ? "已并入正式纪要"
                : bothConfirmed(d)
                  ? "双方已确认，可进入正式纪要"
                  : "已进入共同草稿 · " +
                    BOTH.map((id) =>
                      d.confirmed[id]
                        ? `${state.caseInfo.counselors[id].name}已确认`
                        : `${state.caseInfo.counselors[id].name}待确认`
                    ).join(" / ");
            return (
              <div key={o.id} className="shared-mini">
                <SensitivityTag sensitivity={o.sensitivity} consent={o.consent} />
                <p>{o.text}</p>
                <span>{status}</span>
              </div>
            );
          })}
        </details>
      )}

      <p className="privacy-note">
        {props.otherName} 的私密观察对你不可见——只有其本人“点名分享”后，内容才会出现在右侧共同草稿。
      </p>
    </section>
  );
}

function ObservationForm({
  me,
  onAdd,
}: {
  me: CounselorId;
  onAdd: ReturnType<typeof useSessionStore>["addObservation"];
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("observation");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("normal");
  const [consent, setConsent] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    onAdd({ text, category, sensitivity, consent: sensitivity === "normal" ? false : consent });
    setText("");
    setConsent(false);
  };

  return (
    <div className="obs-form">
      <textarea
        value={text}
        placeholder={`以 ${me === "A" ? "主接" : "协同"} 咨询师身份记录观察、风险、干预或目标…`}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="form-row">
        <Segmented
          options={(Object.keys(CATEGORY_META) as Category[]).map((k) => ({
            value: k,
            label: CATEGORY_META[k].label,
          }))}
          value={category}
          onChange={(v) => setCategory(v as Category)}
        />
      </div>
      <div className="form-row">
        <Segmented
          options={(Object.keys(SENSITIVITY_META) as Sensitivity[]).map((k) => ({
            value: k,
            label: SENSITIVITY_META[k].short,
          }))}
          value={sensitivity}
          onChange={(v) => {
            setSensitivity(v as Sensitivity);
            if (v === "normal") setConsent(false);
          }}
        />
        {sensitivity !== "normal" && (
          <label className="consent-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            已取得当事人/监护人书面同意
          </label>
        )}
      </div>
      <div className="form-row between">
        <span className="rule-hint">
          {sensitivity === "normal"
            ? "一般内容可直接点名分享。"
            : consent
              ? "已授权：可点名分享，导出时保留。"
              : SENSITIVITY_META[sensitivity].label +
                "且未同意：将锁定在私密区，不能分享也不会出现在导出摘要。"}
        </span>
        <button className="primary-action" onClick={submit}>
          存入私密区
        </button>
      </div>
    </div>
  );
}

function ObservationCard({
  obs,
  me,
  onUpdate,
  onShare,
}: {
  obs: Observation;
  me: CounselorId;
  onUpdate: ReturnType<typeof useSessionStore>["updateObservation"];
  onShare: (id: string) => void;
}) {
  const blocked = shareBlocked(obs);
  return (
    <article
      className={`obs-card ${obs.sensitivity !== "normal" && !obs.consent ? "locked" : ""}`}
      style={{ borderLeftColor: COUNSELOR_COLOR[me] }}
    >
      <div className="card-top">
        <span className="cat-tag" style={{ color: CATEGORY_META[obs.category].color }}>
          {CATEGORY_META[obs.category].label}
        </span>
        <SensitivityTag sensitivity={obs.sensitivity} consent={obs.consent} />
        <time>{fmtTime(obs.createdAt)}</time>
      </div>
      <textarea
        className="inline-text"
        value={obs.text}
        onChange={(e) => onUpdate(obs.id, { text: e.target.value })}
      />
      <div className="card-controls">
        <Segmented
          small
          options={(Object.keys(SENSITIVITY_META) as Sensitivity[]).map((k) => ({
            value: k,
            label: SENSITIVITY_META[k].short,
          }))}
          value={obs.sensitivity}
          onChange={(v) =>
            onUpdate(obs.id, {
              sensitivity: v as Sensitivity,
              consent: v === "normal" ? false : obs.consent,
            })
          }
        />
        {obs.sensitivity !== "normal" && (
          <label className="consent-check">
            <input
              type="checkbox"
              checked={obs.consent}
              onChange={(e) => onUpdate(obs.id, { consent: e.target.checked })}
            />
            已取得书面同意
          </label>
        )}
      </div>
      <div className="card-actions">
        <button className="share-btn" disabled={Boolean(blocked)} onClick={() => onShare(obs.id)}>
          点名分享 → 共同草稿
        </button>
        {blocked && <span className="block-reason">⛔ {blocked}</span>}
      </div>
    </article>
  );
}

/* ---------------- 共同草稿区 ---------------- */

function DraftZone(props: {
  state: ReturnType<typeof useSessionStore>["state"];
  me: CounselorId;
  drafts: DraftParagraph[];
  onToggle: (id: string) => void;
  onEditText: (id: string, text: string) => void;
  onWithdraw: (id: string) => void;
  onPublish: () => void;
  hasMinutes: boolean;
}) {
  const { drafts, me, state } = props;
  const confirmedCount = drafts.filter(bothConfirmed).length;
  const allConfirmed = drafts.length > 0 && confirmedCount === drafts.length;

  return (
    <section className="panel zone draft-zone">
      <div className="zone-head">
        <div>
          <p className="zone-kicker shared">两位咨询师共同可见</p>
          <h2>② 共同草稿</h2>
        </div>
        <span className="lock-hint">点名分享后才会出现 · 逐段确认</span>
      </div>

      <div className={`gate ${allConfirmed ? "ready" : ""}`}>
        <div>
          <strong>
            {confirmedCount}/{drafts.length} 段已双方确认
          </strong>
          <p>
            {drafts.length === 0
              ? "还没有被点名分享的观察。"
              : allConfirmed
                ? "全部段落确认完毕，可生成正式纪要。"
                : "每段都需要两位咨询师分别确认，才能生成正式纪要。"}
          </p>
        </div>
        <button className="primary-action" disabled={!allConfirmed} onClick={props.onPublish}>
          {props.hasMinutes ? "确认新段落（走修订留痕）" : "双方确认，生成正式纪要"}
        </button>
      </div>

      <div className="draft-list">
        {drafts.map((d) => (
          <DraftCard
            key={d.id}
            draft={d}
            me={me}
            names={state.caseInfo.counselors}
            onToggle={props.onToggle}
            onEditText={props.onEditText}
            onWithdraw={props.onWithdraw}
          />
        ))}
        {drafts.length === 0 && (
          <p className="empty-hint">
            等待任一方在左侧私密观察区点击“点名分享”。
          </p>
        )}
      </div>
    </section>
  );
}

function DraftCard({
  draft,
  me,
  names,
  onToggle,
  onEditText,
  onWithdraw,
}: {
  draft: DraftParagraph;
  me: CounselorId;
  names: ReturnType<typeof useSessionStore>["state"]["caseInfo"]["counselors"];
  onToggle: (id: string) => void;
  onEditText: (id: string, text: string) => void;
  onWithdraw: (id: string) => void;
}) {
  const done = bothConfirmed(draft);
  const mine = draft.authorId === me;
  const canWithdraw = mine && !done;
  return (
    <article className={`draft-card ${done ? "confirmed" : "pending"}`}>
      <div className="card-top">
        <span className="author-tag" style={{ color: COUNSELOR_COLOR[draft.authorId] }}>
          <i className="dot" style={{ background: COUNSELOR_COLOR[draft.authorId] }} />
          {names[draft.authorId].name} 点名分享
        </span>
        <span className="cat-tag" style={{ color: CATEGORY_META[draft.category].color }}>
          {CATEGORY_META[draft.category].label}
        </span>
        <SensitivityTag sensitivity={draft.sensitivity} consent={draft.consent} />
        <time>{fmtTime(draft.sharedAt)}</time>
      </div>
      <textarea
        className="inline-text"
        value={draft.text}
        onChange={(e) => onEditText(draft.id, e.target.value)}
      />
      <div className="confirm-row">
        {BOTH.map((id) => {
          const on = draft.confirmed[id];
          return (
            <label
              key={id}
              className={`confirm-chip ${on ? "on" : ""} ${id === me ? "is-me" : "locked-check"}`}
              style={on ? { borderColor: COUNSELOR_COLOR[id], background: `${COUNSELOR_COLOR[id]}12` } : undefined}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={id !== me}
                onChange={() => onToggle(draft.id)}
              />
              {names[id].name}
              <small>{on ? "已确认" : id === me ? "点击确认" : "待对方确认"}</small>
            </label>
          );
        })}
        <span className={`status-pill ${done ? "ok" : "wait"}`}>
          {done ? "✓ 双方已确认" : "待确认"}
        </span>
      </div>
      {canWithdraw && (
        <button className="ghost-btn tiny" onClick={() => onWithdraw(draft.id)}>
          撤回我的分享（内容回到私密区）
        </button>
      )}
    </article>
  );
}

/* ---------------- 正式纪要 ---------------- */

function MinutesPanel(props: {
  state: ReturnType<typeof useSessionStore>["state"];
  me: CounselorId;
  latest?: MinutesVersion;
  foldedCount: number;
  activeDrafts: DraftParagraph[];
  onRevise: (input: {
    keptIds: string[];
    texts: Record<string, string>;
    reason: string;
  }) => string | null;
}) {
  const { state, latest, me } = props;
  const [revising, setRevising] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewVersion, setViewVersion] = useState<number | null>(null);

  return (
    <section className="panel minutes-panel">
      <div className="section-heading">
        <div>
          <p>正式记录</p>
          <h2>③ 正式会谈纪要</h2>
        </div>
        {latest && (
          <div className="heading-actions">
            <button onClick={() => setHistoryOpen((v) => !v)}>
              {historyOpen ? "收起版本历史" : `版本历史（${state.versions.length}）`}
            </button>
            <button onClick={() => setRevising((v) => !v)}>
              {revising ? "取消修订" : "修订纪要"}
            </button>
            <button className="primary-action" onClick={() => setExportOpen(true)}>
              导出正式摘要
            </button>
          </div>
        )}
      </div>

      {!latest && (
        <p className="empty-hint">
          正式纪要尚未生成：右侧共同草稿的全部段落经两位咨询师逐段确认后，点击“双方确认，生成正式纪要”。
        </p>
      )}

      {historyOpen && latest && (
        <div className="version-history">
          <h3>版本留痕（旧版本全文可回看）</h3>
          {[...state.versions].reverse().map((v) => (
            <div key={v.version} className={`version-row ${v.version === latest.version ? "current" : ""}`}>
              <button className="version-link" onClick={() => setViewVersion(v.version)}>
                v{v.version}
              </button>
              <div>
                <strong>
                  {fmtFull(v.createdAt)} · {state.caseInfo.counselors[v.editorId].name} 操作
                </strong>
                <p>修改原因：{v.reason}</p>
                <small>共 {v.paragraphs.length} 段</small>
              </div>
            </div>
          ))}
        </div>
      )}

      {latest && !revising && (
        <>
          <div className="version-meta">
            <span className="version-badge">v{latest.version}</span>
            <span>
              生成于 {fmtFull(latest.createdAt)} · 操作人：
              {state.caseInfo.counselors[latest.editorId].name}
            </span>
          </div>
          <p className="version-reason">修改原因：{latest.reason}</p>
          <div className="minutes-body">
            {latest.paragraphs.map((p, i) => (
              <div key={p.id} className="minutes-p">
                <span className="p-no">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="card-top">
                    <span className="cat-tag" style={{ color: CATEGORY_META[p.category].color }}>
                      {CATEGORY_META[p.category].label}
                    </span>
                    <span className="author-tag" style={{ color: COUNSELOR_COLOR[p.authorId] }}>
                      {state.caseInfo.counselors[p.authorId].name}
                    </span>
                    <SensitivityTag sensitivity={p.sensitivity} consent={p.consent} />
                  </div>
                  <p>{p.text}</p>
                </div>
              </div>
            ))}
          </div>
          {props.foldedCount > 0 && (
            <details className="shared-fold">
              <summary>已并入纪要的原始草稿（{props.foldedCount}）</summary>
              {state.drafts
                .filter((d) => d.folded)
                .map((d) => (
                  <div key={d.id} className="shared-mini">
                    <p>{d.text}</p>
                    <span>
                      {state.caseInfo.counselors[d.authorId].name} 分享 ·{" "}
                      {fmtTime(d.sharedAt)} 双方确认
                    </span>
                  </div>
                ))}
            </details>
          )}
        </>
      )}

      {latest && revising && (
        <ReviseForm
          state={state}
          me={me}
          latest={latest}
          activeDrafts={props.activeDrafts}
          onCancel={() => setRevising(false)}
          onSubmit={(input) => {
            const err = props.onRevise(input);
            if (!err) setRevising(false);
          }}
        />
      )}

      {exportOpen && latest && (
        <ExportModal
          state={state}
          version={latest}
          onClose={() => setExportOpen(false)}
        />
      )}

      {viewVersion !== null && (
        <VersionViewer
          state={state}
          version={state.versions.find((v) => v.version === viewVersion)}
          onClose={() => setViewVersion(null)}
        />
      )}
    </section>
  );
}

function ReviseForm({
  state,
  latest,
  activeDrafts,
  onCancel,
  onSubmit,
}: {
  state: ReturnType<typeof useSessionStore>["state"];
  me: CounselorId;
  latest: MinutesVersion;
  activeDrafts: DraftParagraph[];
  onCancel: () => void;
  onSubmit: (input: { keptIds: string[]; texts: Record<string, string>; reason: string }) => void;
}) {
  const [kept, setKept] = useState<Set<string>>(new Set(latest.paragraphs.map((p) => p.id)));
  const [texts, setTexts] = useState<Record<string, string>>(
    Object.fromEntries(latest.paragraphs.map((p) => [p.id, p.text]))
  );
  const [reason, setReason] = useState("");

  const toggleKept = (id: string) =>
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const newcomerBlocked = activeDrafts.some((d) => !bothConfirmed(d));

  return (
    <div className="revise-form">
      <p className="revise-note">
        修订将生成新版本并完整保留当前 v{latest.version} 旧版全文；请勾选保留段落、可修改文字，并填写修改原因。
      </p>
      {latest.paragraphs.map((p, i) => (
        <div key={p.id} className={`revise-row ${kept.has(p.id) ? "" : "removed"}`}>
          <label className="keep-check">
            <input type="checkbox" checked={kept.has(p.id)} onChange={() => toggleKept(p.id)} />
            保留
          </label>
          <span className="p-no">{String(i + 1).padStart(2, "0")}</span>
          <textarea
            disabled={!kept.has(p.id)}
            value={texts[p.id] ?? ""}
            onChange={(e) => setTexts((t) => ({ ...t, [p.id]: e.target.value }))}
          />
        </div>
      ))}

      {activeDrafts.length > 0 && (
        <div className="newcomers">
          <h4>生成纪要后新增的共同草稿（确认后并入新版本）</h4>
          {activeDrafts.map((d) => (
            <div key={d.id} className="shared-mini">
              <p>{d.text}</p>
              <span className={bothConfirmed(d) ? "ok-text" : "warn-text"}>
                {bothConfirmed(d)
                  ? "✓ 双方已确认，将并入新版本"
                  : "⛔ 尚未双方确认，不能并入（请先在草稿区完成确认）"}
              </span>
            </div>
          ))}
        </div>
      )}

      <label className="reason-field">
        <span>修改原因（必填，将与旧版本、时间、操作人一并留痕）</span>
        <textarea
          value={reason}
          placeholder="例如：第 2 段经督导复核后调整措辞；删除重复记录…"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="revise-actions">
        <button onClick={onCancel}>取消</button>
        <button
          className="primary-action"
          disabled={!reason.trim() || kept.size === 0 || newcomerBlocked}
          onClick={() =>
            onSubmit({ keptIds: [...kept], texts, reason })
          }
        >
          保存为 v{latest.version + 1}
        </button>
      </div>
    </div>
  );
}

/* ---------------- 导出过滤 ---------------- */

function ExportModal({
  state,
  version,
  onClose,
}: {
  state: ReturnType<typeof useSessionStore>["state"];
  version: MinutesVersion;
  onClose: () => void;
}) {
  const lines = buildExportLines(version);
  const keptCount = lines.filter((l) => l.kept).length;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>导出正式摘要 · 逐条过滤</h2>
          <button className="ghost-btn" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="revise-note">
          依据 v{version.version} 生成；涉及来访者亲属或未经同意第三人且未授权的段落将被过滤，逐条原因如下。
        </p>
        <div className="filter-table">
          {lines.map((l) => (
            <div key={l.no} className={`filter-row ${l.kept ? "kept" : "dropped"}`}>
              <span className="filter-no">{String(l.no).padStart(2, "0")}</span>
              <div className="filter-body">
                <p>
                  <span className="cat-tag">{l.category}</span>
                  {l.kept ? l.text : "（本条内容不予显示）"}
                </p>
                <small>
                  <b>{l.kept ? "纳入" : "过滤"}：</b>
                  {l.reason}
                </small>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <span>
            共 {lines.length} 条 · 纳入 {keptCount} · 过滤 {lines.length - keptCount}
          </span>
          <button
            className="primary-action"
            onClick={() =>
              downloadText(
                `${state.caseInfo.code}-正式摘要-v${version.version}.txt`,
                buildSummaryText(state.caseInfo, version, lines)
              )
            }
          >
            下载 .txt 摘要
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionViewer({
  state,
  version,
  onClose,
}: {
  state: ReturnType<typeof useSessionStore>["state"];
  version?: MinutesVersion;
  onClose: () => void;
}) {
  if (!version) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>历史版本 v{version.version}（只读全文快照）</h2>
          <button className="ghost-btn" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="version-reason">
          {fmtFull(version.createdAt)} · 操作人：
          {state.caseInfo.counselors[version.editorId].name} · 修改原因：{version.reason}
        </p>
        <div className="minutes-body">
          {version.paragraphs.map((p, i) => (
            <div key={p.id} className="minutes-p">
              <span className="p-no">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="card-top">
                  <span className="cat-tag" style={{ color: CATEGORY_META[p.category].color }}>
                    {CATEGORY_META[p.category].label}
                  </span>
                  <SensitivityTag sensitivity={p.sensitivity} consent={p.consent} />
                </div>
                <p>{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 通用小部件 ---------------- */

function SensitivityTag({
  sensitivity,
  consent,
}: {
  sensitivity: Sensitivity;
  consent: boolean;
}) {
  const sensitive = sensitivity !== "normal";
  const cls = !sensitive ? "tag-normal" : consent ? "tag-consent" : "tag-locked";
  return (
    <span className={`sens-tag ${cls}`}>
      {sensitive ? (consent ? "🔓 " : "🔒 ") : ""}
      {SENSITIVITY_META[sensitivity].label}
      {sensitive ? (consent ? "·已授权" : "·未同意") : ""}
    </span>
  );
}

function Segmented({
  options,
  value,
  onChange,
  small,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
}) {
  return (
    <div className={`segmented ${small ? "sm" : ""}`}>
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? "seg active" : "seg"}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default App;
