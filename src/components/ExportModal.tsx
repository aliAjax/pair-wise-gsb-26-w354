import { useMemo, useState } from "react";
import type { CounselorId, FilterEntry, SessionState } from "../types";
import { COUNSELORS, buildExportText, buildFilterLedger, downloadText, formatTime } from "../store";

interface Props {
  state: SessionState;
  viewer: CounselorId;
  onClose: () => void;
  notify: (message: string) => void;
}

const GROUP_LABELS: Record<FilterEntry["group"], string> = {
  sensitive: "🔒 私密保留：涉亲属 / 未经同意第三人",
  unshared: "未点名分享的个人观察",
  "draft-pending": "共同草稿中未获双方确认",
};

export function ExportModal({ state, viewer, onClose, notify }: Props) {
  const [copied, setCopied] = useState(false);
  const exportText = useMemo(() => buildExportText(state), [state]);
  const ledger = useMemo(() => buildFilterLedger(state, viewer), [state, viewer]);

  const fullText = useMemo(() => {
    const lines: string[] = [exportText, "", "二、过滤台账（以下条目未收录，逐条说明原因）", "-".repeat(24)];
    if (ledger.length === 0) {
      lines.push("（无被过滤条目）");
    } else {
      const groups: FilterEntry["group"][] = ["sensitive", "draft-pending", "unshared"];
      let idx = 1;
      groups.forEach((g) => {
        const items = ledger.filter((e) => e.group === g);
        if (items.length === 0) return;
        lines.push("");
        lines.push(`【${GROUP_LABELS[g]}】`);
        items.forEach((e) => {
          lines.push(`${idx++}. 被过滤内容：${e.content}`);
          lines.push(`   原因：${e.reason}`);
        });
      });
    }
    lines.push("");
    lines.push(`导出台账生成时间：${formatTime(Date.now())} · 导出人：${COUNSELORS[viewer].name}`);
    return lines.join("\n");
  }, [exportText, ledger, viewer]);

  function copy() {
    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => notify("复制失败，请使用下载按钮"));
  }

  function download() {
    downloadText(`联合会谈摘要_${state.clientCode}_${state.sessionDate}.txt`, fullText);
    notify("已导出含过滤台账的正式摘要");
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">导出前逐条复核</p>
            <h2>正式摘要与过滤台账</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="modal-body">
          <section>
            <h3>① 正式摘要（仅双方已确认段落）</h3>
            <pre className="export-text">{exportText}</pre>
          </section>

          <section>
            <h3>
              ② 过滤台账 · 共 {ledger.length} 条不收录
              <span className="ledger-hint">涉亲属/未经同意第三人的段落强制留在私密区，另一位咨询师的私密内容不显示原文</span>
            </h3>
            {ledger.length === 0 ? (
              <p className="empty-hint">没有需要过滤的条目。</p>
            ) : (
              <div className="ledger">
                {(["sensitive", "draft-pending", "unshared"] as FilterEntry["group"][]).map((g) => {
                  const items = ledger.filter((e) => e.group === g);
                  if (items.length === 0) return null;
                  return (
                    <div key={g} className={`ledger-group ledger-${g}`}>
                      <h4>
                        {GROUP_LABELS[g]} · {items.length} 条
                      </h4>
                      {items.map((e, i) => (
                        <div key={i} className="ledger-item">
                          <p className="ledger-content">{e.content}</p>
                          <p className="ledger-reason">过滤原因：{e.reason}</p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="modal-foot">
          <span className="export-note">导出文件为纯文本，已逐条列示被过滤内容及原因。</span>
          <button type="button" onClick={copy}>
            {copied ? "已复制 ✓" : "复制全文"}
          </button>
          <button type="button" className="primary-action" onClick={download}>
            下载 .txt
          </button>
        </div>
      </div>
    </div>
  );
}
