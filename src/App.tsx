import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { CounselorId, SessionState } from "./types";
import {
  COUNSELORS,
  addObservation,
  deleteObservation,
  editDraftContent,
  editMinutes,
  generateMinutes,
  loadState,
  resetState,
  restoreMinutes,
  saveState,
  shareObservation,
  toggleDraftConfirm,
  withdrawDraft,
  isBothConfirmed,
} from "./store";
import { PrivateZone } from "./components/PrivateZone";
import { SharedDraftZone } from "./components/SharedDraftZone";
import { MinutesZone } from "./components/MinutesZone";
import { ExportModal } from "./components/ExportModal";

function App() {
  const [state, setState] = useState<SessionState>(() => loadState());
  const [viewer, setViewer] = useState<CounselorId>("A");
  const [toast, setToast] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  const pendingDrafts = state.drafts.filter((d) => !isBothConfirmed(d));
  const confirmedDrafts = state.drafts.filter(isBothConfirmed);
  const sensitiveTotal = state.observations.filter((o) => o.sensitive).length;

  const viewerConfirms = useMemo(() => {
    const ownObs = state.observations.filter((o) => o.authorId === viewer && !o.sensitive).length;
    return { ownObs };
  }, [state.observations, viewer]);

  function handleDeleteObs(obsId: string) {
    const before = state;
    const next = deleteObservation(state, obsId);
    if (next === before) {
      notify("该观察对应段落已双方确认并入正式纪要，请通过正式纪要修订处理");
      return;
    }
    setState(next);
    notify("已删除；若此前已分享且未确认，对应草稿一并撤回");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-12 · 联合会谈记录台</p>
          <h1>两位咨询师 · 同一场会谈</h1>
          <p className="subtitle">
            各自先在私密区写观察，点名分享后段落才进入共同草稿；两位逐段确认后生成正式纪要。
            涉来访者亲属或未经同意第三人的内容始终留在私密区，导出时逐条过滤并说明原因；正式纪要的每次改动都保留旧版本、原因与时间。
          </p>
          <div className="case-meta">
            <label>
              <span>来访者代号</span>
              <input value={state.clientCode} onChange={(e) => setState({ ...state, clientCode: e.target.value })} />
            </label>
            <label>
              <span>咨询主题</span>
              <input value={state.topic} onChange={(e) => setState({ ...state, topic: e.target.value })} />
            </label>
            <label>
              <span>会谈日期</span>
              <input
                type="date"
                value={state.sessionDate}
                onChange={(e) => setState({ ...state, sessionDate: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="stack-card identity-card">
          <span>当前身份（模拟两位咨询师分别登录）</span>
          <div className="identity-switch">
            {(["A", "B"] as CounselorId[]).map((cid) => (
              <button
                key={cid}
                type="button"
                className={viewer === cid ? "identity-on" : ""}
                onClick={() => setViewer(cid)}
              >
                <strong>{COUNSELORS[cid].name}</strong>
                <em>{COUNSELORS[cid].role}</em>
              </button>
            ))}
          </div>
          <p className="identity-note">
            切换身份即可看到：对方私密区对你关闭；你只能勾选自己的确认框。
          </p>
          <button
            type="button"
            className="reset-btn"
            onClick={() => {
              setState(resetState());
              notify("已恢复为演示数据");
            }}
          >
            重置演示数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>我的私密观察</span>
          <strong>{viewerConfirms.ownObs}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>草稿待确认段落</span>
          <strong>{pendingDrafts.length}</strong>
          <i className="status-watch" />
        </article>
        <article className="metric-card">
          <span>双方已确认段落</span>
          <strong>{confirmedDrafts.length}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>私密保留 / 纪要版本</span>
          <strong>
            {sensitiveTotal} / v{state.currentMinutesVersion ?? "—"}
          </strong>
          <i className="status-danger" />
        </article>
      </section>

      {pendingDrafts.length > 0 && (
        <div className="reopen-banner">
          📌 重新打开本页时仍有 <strong>{pendingDrafts.length}</strong> 段待确认内容保留在共同草稿中：
          {pendingDrafts.map((d) => (
            <span key={d.id} className="banner-chip">
              {COUNSELORS[d.sharedById].name}分享 · {d.content.slice(0, 18)}…（甲{d.confirmedA ? "✓" : "✗"}/乙
              {d.confirmedB ? "✓" : "✗"}）
            </span>
          ))}
        </div>
      )}

      <section className="private-grid">
        <PrivateZone
          counselorId="A"
          viewer={viewer}
          observations={state.observations}
          onAdd={(content, sensitive) => {
            setState((s) => addObservation(s, "A", content, sensitive));
            notify(sensitive ? "已保存至甲的私密区（敏感内容不可分享）" : "已保存至甲的私密区");
          }}
          onShare={(obsId) => {
            setState((s) => shareObservation(s, obsId));
            notify("已点名分享，甲的确认已自动勾选，等待乙确认");
          }}
          onDelete={handleDeleteObs}
          notify={notify}
        />
        <PrivateZone
          counselorId="B"
          viewer={viewer}
          observations={state.observations}
          onAdd={(content, sensitive) => {
            setState((s) => addObservation(s, "B", content, sensitive));
            notify(sensitive ? "已保存至乙的私密区（敏感内容不可分享）" : "已保存至乙的私密区");
          }}
          onShare={(obsId) => {
            setState((s) => shareObservation(s, obsId));
            notify("已点名分享，乙的确认已自动勾选，等待甲确认");
          }}
          onDelete={handleDeleteObs}
          notify={notify}
        />
      </section>

      <SharedDraftZone
        viewer={viewer}
        drafts={state.drafts}
        observations={state.observations}
        hasMinutes={state.currentMinutesVersion !== null}
        onToggleConfirm={(draftId, counselor) => {
          if (counselor !== viewer) {
            notify("只能由本人勾选/取消自己的确认");
            return;
          }
          setState((s) => toggleDraftConfirm(s, draftId, counselor));
        }}
        onEditContent={(draftId, content) => {
          setState((s) => editDraftContent(s, draftId, content));
          notify("草稿已修改，双方确认状态已重置，需要重新逐段确认");
        }}
        onWithdraw={(draftId) => {
          setState((s) => withdrawDraft(s, draftId));
          notify("已撤回到分享人的私密区");
        }}
        onGenerate={(reason) => {
          setState((s) => generateMinutes(s, viewer, reason));
          notify(state.currentMinutesVersion === null ? "正式纪要已生成" : "已保存为正式纪要新版本");
        }}
        notify={notify}
      />

      <MinutesZone
        viewer={viewer}
        versions={state.minutesVersions}
        currentVersion={state.currentMinutesVersion}
        onEdit={(paragraphs, reason) => {
          setState((s) => editMinutes(s, viewer, paragraphs, reason));
          notify("旧版本已归档，修订内容保存为新版本");
        }}
        onRestore={(target, reason) => {
          setState((s) => restoreMinutes(s, viewer, target, reason));
          notify(`已回退为基于 v${target} 的新版本`);
        }}
        onOpenExport={() => setExportOpen(true)}
        notify={notify}
      />

      {exportOpen && (
        <ExportModal state={state} viewer={viewer} onClose={() => setExportOpen(false)} notify={notify} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default App;
