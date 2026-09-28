import { useState } from "react";
import type { CounselorId, MinutesVersion } from "../types";
import { COUNSELORS, formatTime } from "../store";

interface Props {
  viewer: CounselorId;
  versions: MinutesVersion[];
  currentVersion: number | null;
  onEdit: (paragraphs: string[], reason: string) => void;
  onRestore: (targetVersion: number, reason: string) => void;
  onOpenExport: () => void;
  notify: (message: string) => void;
}

export function MinutesZone({ viewer, versions, currentVersion, onEdit, onRestore, onOpenExport, notify }: Props) {
  const current = versions.find((v) => v.version === currentVersion) ?? null;
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editReason, setEditReason] = useState("");

  function startEdit() {
    if (!current) return;
    setEditText(current.paragraphs.join("\n\n"));
    setEditReason("");
    setEditing(true);
  }

  function submitEdit() {
    const paragraphs = editText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) {
      notify("纪要内容不能为空");
      return;
    }
    if (!editReason.trim()) {
      notify("必须填写修改原因，旧版本才会带着原因归档");
      return;
    }
    onEdit(paragraphs, editReason);
    setEditing(false);
  }

  return (
    <section className="panel minutes-panel">
      <div className="section-heading">
        <div>
          <p>双方确认后固化 · 每次改动均留存旧版本</p>
          <h2>正式纪要{current ? ` · 当前 v${current.version}` : ""}</h2>
        </div>
        <div className="minutes-actions">
          {current && !editing && (
            <button type="button" onClick={startEdit}>
              ✎ 修订当前纪要
            </button>
          )}
          <button type="button" className="primary-action" onClick={onOpenExport} disabled={!current}>
            导出正式摘要
          </button>
        </div>
      </div>

      {!current ? (
        <p className="empty-hint">
          尚无正式纪要。共同草稿中的段落经两位咨询师逐段确认后，点击上方「生成正式纪要」。
        </p>
      ) : editing ? (
        <div className="minutes-editor">
          <p className="editor-hint">每段之间空一行分隔。保存后当前内容成为 v{current.version} 的旧版本归档。</p>
          <textarea rows={9} value={editText} onChange={(e) => setEditText(e.target.value)} />
          <input
            className="reason-input"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="必填：修改原因（将记录在新版本中）"
          />
          <div className="draft-edit-actions">
            <button type="button" className="primary-action" onClick={submitEdit}>
              保存新版本
            </button>
            <button type="button" className="ghost-btn" onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="minutes-meta">
            <span>
              v{current.version} · {formatTime(current.createdAt)} · {COUNSELORS[current.editorId].name}
            </span>
            {current.changeReason ? (
              <span className="change-reason">修订原因：{current.changeReason}</span>
            ) : (
              <span className="change-reason muted">首次由双方确认段落生成</span>
            )}
          </div>
          <ol className="minutes-body">
            {current.paragraphs.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </>
      )}

      {versions.length > 0 && (
        <div className="version-history">
          <h3>版本记录（旧版本只读、可回退）</h3>
          <div className="version-list">
            {sorted.map((v) => (
              <VersionRow
                key={v.version}
                v={v}
                isCurrent={v.version === currentVersion}
                viewer={viewer}
                onRestore={onRestore}
                notify={notify}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function VersionRow({
  v,
  isCurrent,
  viewer,
  onRestore,
  notify,
}: {
  v: MinutesVersion;
  isCurrent: boolean;
  viewer: CounselorId;
  onRestore: (targetVersion: number, reason: string) => void;
  notify: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoring, setRestoring] = useState(false);

  function submitRestore() {
    if (!restoreReason.trim()) {
      notify("回退同样需要填写原因");
      return;
    }
    onRestore(v.version, restoreReason);
    setRestoring(false);
    setRestoreReason("");
    setOpen(false);
  }

  return (
    <article className={`version-row ${isCurrent ? "current" : ""}`}>
      <button type="button" className="version-summary" onClick={() => setOpen(!open)}>
        <strong>v{v.version}</strong>
        <span>{formatTime(v.createdAt)}</span>
        <span>{COUNSELORS[v.editorId].name}</span>
        <span className="version-reason">{v.changeReason ?? "首次生成"}</span>
        {isCurrent && <span className="current-badge">当前</span>}
        <span className="caret">{open ? "收起 ▲" : "展开 ▼"}</span>
      </button>
      {open && (
        <div className="version-detail">
          <ol>
            {v.paragraphs.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
          {!isCurrent && (
            <div className="restore-box">
              {!restoring ? (
                <button type="button" className="ghost-btn" onClick={() => setRestoring(true)}>
                  以此版本为基础回退（生成新版本，历史不改写）
                </button>
              ) : (
                <>
                  <input
                    className="reason-input"
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                    placeholder={`必填：为什么回退到 v${v.version}（操作人：${COUNSELORS[viewer].name}）`}
                  />
                  <div className="draft-edit-actions">
                    <button type="button" className="primary-action" onClick={submitRestore}>
                      确认回退
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => setRestoring(false)}>
                      取消
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
