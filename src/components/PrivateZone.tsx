import { useState } from "react";
import type { CounselorId, Observation, SensitiveCategory } from "../types";
import { COUNSELORS, SENSITIVE_LABELS, formatTime } from "../store";

interface Props {
  counselorId: CounselorId;
  viewer: CounselorId;
  observations: Observation[];
  onAdd: (content: string, sensitive: SensitiveCategory | null) => void;
  onShare: (obsId: string) => void;
  onDelete: (obsId: string) => void;
  notify: (message: string) => void;
}

export function PrivateZone({ counselorId, viewer, observations, onAdd, onShare, onDelete, notify }: Props) {
  const mine = viewer === counselorId;
  const [draft, setDraft] = useState("");
  const [sensitive, setSensitive] = useState<SensitiveCategory | null>(null);

  const ownObs = observations.filter((o) => o.authorId === counselorId);
  const sensitiveCount = ownObs.filter((o) => o.sensitive).length;
  function submit() {
    if (!draft.trim()) {
      notify("请先填写观察内容");
      return;
    }
    onAdd(draft, sensitive);
    setDraft("");
    setSensitive(null);
  }

  return (
    <section className={`panel private-panel counselor-${counselorId}`}>
      <div className="private-head">
        <div>
          <span className="lock-badge">🔒 仅本人可见</span>
          <h2>
            {COUNSELORS[counselorId].name}的私密观察
            {!mine && <em className="viewer-note">（你是{COUNSELORS[viewer].name}，此处内容不可见）</em>}
          </h2>
          <p className="panel-desc">
            {COUNSELORS[counselorId].role}
            {mine
              ? ` · 共 ${ownObs.length} 条观察${
                  sensitiveCount > 0 ? ` · ${sensitiveCount} 条因涉亲属/第三人留在私密区` : ""
                }`
              : " · 内容数量与原文均不展示"}
          </p>
        </div>
      </div>

      {!mine ? (
        <div className="locked-placeholder">
          <strong>私密区</strong>
          <span>该咨询师的观察仅其本人可见；点名分享后，对应段落才会出现在共同草稿中。</span>
        </div>
      ) : (
        <>
          <div className="obs-editor">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="记录只属于你的观察（躯体反应、言语细节、个人假设……），默认不会被对方看到。"
              rows={3}
            />
            <div className="obs-editor-bar">
              <div className="sensitive-toggle">
                <button
                  type="button"
                  className={sensitive === "relative" ? "chip-on" : ""}
                  onClick={() => setSensitive(sensitive === "relative" ? null : "relative")}
                  title={SENSITIVE_LABELS.relative.reason}
                >
                  标记：涉及来访者亲属
                </button>
                <button
                  type="button"
                  className={sensitive === "thirdparty" ? "chip-on" : ""}
                  onClick={() => setSensitive(sensitive === "thirdparty" ? null : "thirdparty")}
                  title={SENSITIVE_LABELS.thirdparty.reason}
                >
                  标记：涉及未经同意第三人
                </button>
              </div>
              <button type="button" className="primary-action" onClick={submit}>
                保存到私密区
              </button>
            </div>
            {sensitive && <p className="sensitive-hint">⚠ {SENSITIVE_LABELS[sensitive].reason}</p>}
          </div>

          <div className="obs-list">
            {ownObs.length === 0 && <p className="empty-hint">暂无观察，开始记录第一条吧。</p>}
            {ownObs.map((o) => (
              <ObsCard key={o.id} obs={o} onShare={() => onShare(o.id)} onDelete={() => onDelete(o.id)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ObsCard({
  obs,
  onShare,
  onDelete,
}: {
  obs: Observation;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`obs-card ${obs.sensitive ? "is-sensitive" : ""} ${obs.sharedDraftId ? "is-shared" : ""}`}>
      <div className="obs-card-meta">
        <span>{formatTime(obs.createdAt)}</span>
        {obs.sensitive ? (
          <span className="tag tag-sensitive">🔒 {SENSITIVE_LABELS[obs.sensitive].label}</span>
        ) : obs.sharedDraftId ? (
          <span className="tag tag-shared">已点名分享 → 共同草稿</span>
        ) : (
          <span className="tag tag-private">未分享</span>
        )}
      </div>
      <p className="obs-content">{obs.content}</p>
      {obs.sensitive && <p className="sensitive-hint">{SENSITIVE_LABELS[obs.sensitive].reason}</p>}
      <div className="obs-card-actions">
        {obs.sensitive ? (
          <button type="button" disabled title="涉敏感内容，必须留在私密区">
            禁止分享（私密保留）
          </button>
        ) : obs.sharedDraftId ? (
          <span className="shared-note">已在共同草稿中等待双方确认，请到下方处理</span>
        ) : (
          <button type="button" className="share-btn" onClick={onShare}>
            点名分享给对方
          </button>
        )}
        <button type="button" className="ghost-danger" onClick={onDelete}>
          删除
        </button>
      </div>
    </article>
  );
}
