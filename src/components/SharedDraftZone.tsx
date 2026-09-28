import { useState } from "react";
import type { CounselorId, DraftParagraph, Observation } from "../types";
import { COUNSELORS, formatTime, isBothConfirmed } from "../store";

interface Props {
  viewer: CounselorId;
  drafts: DraftParagraph[];
  observations: Observation[];
  hasMinutes: boolean;
  onToggleConfirm: (draftId: string, counselor: CounselorId) => void;
  onEditContent: (draftId: string, content: string) => void;
  onWithdraw: (draftId: string) => void;
  onGenerate: (reason: string) => void;
  notify: (message: string) => void;
}

export function SharedDraftZone({
  viewer,
  drafts,
  observations,
  hasMinutes,
  onToggleConfirm,
  onEditContent,
  onWithdraw,
  onGenerate,
  notify,
}: Props) {
  const [reason, setReason] = useState("");
  const confirmedCount = drafts.filter(isBothConfirmed).length;
  const pendingCount = drafts.length - confirmedCount;

  function generate() {
    if (confirmedCount === 0) {
      notify("没有双方均已确认的段落，无法生成正式纪要");
      return;
    }
    if (hasMinutes && !reason.trim()) {
      notify("正式纪要已存在，本次更新必须填写修改原因");
      return;
    }
    onGenerate(reason);
    setReason("");
  }

  return (
    <section className="panel draft-panel">
      <div className="section-heading">
        <div>
          <p>点名分享后的段落汇集于此</p>
          <h2>共同草稿</h2>
        </div>
        <div className="draft-progress">
          <span className="pill pill-ok">双方确认 {confirmedCount}</span>
          <span className="pill pill-pending">待确认 {pendingCount}</span>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="pending-banner">
          ⏳ 有 <strong>{pendingCount}</strong> 段尚未经双方确认；重新打开本页时这些待确认段落仍会保留在此处。
        </div>
      )}

      {drafts.length === 0 ? (
        <p className="empty-hint">
          共同草稿还是空的。咨询师在各自私密区点击「点名分享」后，段落才会进入这里。
        </p>
      ) : (
        <div className="draft-list">
          {drafts.map((d) => {
            const source = observations.find((o) => o.id === d.sourceObservationId);
            const done = isBothConfirmed(d);
            return (
              <article key={d.id} className={`draft-card ${done ? "is-confirmed" : "is-pending"}`}>
                <div className="draft-card-head">
                  <span className="draft-source">
                    来自 {source ? COUNSELORS[source.authorId].name : "未知"} 的观察 ·{" "}
                    {formatTime(d.createdAt)}
                    {d.updatedAt !== d.createdAt && ` · 编辑于 ${formatTime(d.updatedAt)}`}
                  </span>
                  <span className={`tag ${done ? "tag-confirmed" : "tag-pending"}`}>
                    {done ? `双方已确认 · ${d.confirmedAt ? formatTime(d.confirmedAt) : ""}` : "待确认"}
                  </span>
                </div>

                <DraftEditor draft={d} onSave={(content) => onEditContent(d.id, content)} notify={notify} />

                <div className="confirm-row">
                  {(["A", "B"] as CounselorId[]).map((cid) => (
                    <label key={cid} className={`confirm-check confirm-${cid} ${d[`confirmed${cid}`] ? "checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={d[`confirmed${cid}`]}
                        disabled={viewer !== cid}
                        onChange={() => onToggleConfirm(d.id, cid)}
                      />
                      <span>
                        {COUNSELORS[cid].name}
                        {viewer !== cid ? "（仅本人可勾选）" : d[`confirmed${cid}`] ? "已确认" : "点击确认"}
                      </span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={done}
                    title={done ? "双方已确认，不能撤回；如需修改请直接编辑草稿" : "由分享人撤回至私密区"}
                    onClick={() => onWithdraw(d.id)}
                  >
                    撤回到私密区
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="generate-box">
        <div className="generate-info">
          <strong>{hasMinutes ? "更新正式纪要" : "生成正式纪要"}</strong>
          <span>
            {confirmedCount === 0
              ? "需双方逐段确认后才可生成"
              : `将收录 ${confirmedCount} 段双方确认内容${pendingCount > 0 ? `，${pendingCount} 段待确认内容不收录` : ""}`}
          </span>
        </div>
        {hasMinutes && (
          <input
            className="reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="必填：本次更新正式纪要的修改原因（旧版本将自动留存）"
          />
        )}
        <button type="button" className="primary-action" disabled={confirmedCount === 0} onClick={generate}>
          {hasMinutes ? "保存为新版本" : "双方确认，生成正式纪要"}
        </button>
      </div>
    </section>
  );
}

function DraftEditor({
  draft,
  onSave,
  notify,
}: {
  draft: DraftParagraph;
  onSave: (content: string) => void;
  notify: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.content);

  if (!editing) {
    return (
      <div className="draft-text">
        <p>{draft.content}</p>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setText(draft.content);
            setEditing(true);
          }}
        >
          ✎ 编辑措辞
        </button>
      </div>
    );
  }

  return (
    <div className="draft-text">
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="draft-edit-actions">
        <button
          type="button"
          className="primary-action"
          onClick={() => {
            if (!text.trim()) {
              notify("段落内容不能为空");
              return;
            }
            onSave(text);
            setEditing(false);
          }}
        >
          保存（双方确认将重置）
        </button>
        <button type="button" className="ghost-btn" onClick={() => setEditing(false)}>
          取消
        </button>
      </div>
    </div>
  );
}
