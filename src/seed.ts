import type { SessionState } from "./types";

const now = Date.now();
const MIN = 60 * 1000;

/** 首次打开的示例数据：覆盖 已分享待确认 / 双方已确认 / 敏感锁定私密 三种情形 */
export function buildSeed(): SessionState {
  return {
    caseInfo: {
      code: "C-042",
      topic: "焦虑",
      sessionNo: "第 7 次",
      sessionDate: "2026-09-28",
      mainConcern: "工作汇报前心悸、入睡困难，担心同事评价",
      emotionalState: "紧张、自责，谈到家庭时情绪波动明显",
      riskLevel: "中风险",
      nextGoal: "继续呼吸放松练习，准备一次 5 分钟汇报预演",
      counselors: {
        A: { id: "A", name: "林岚", title: "主接咨询师" },
        B: { id: "B", name: "周明", title: "协同咨询师" },
      },
    },
    observations: [
      {
        id: "obs-seed-1",
        authorId: "A",
        category: "observation",
        text: "来访者谈到本周睡眠略有改善，工作日能在 30 分钟内入睡。",
        sensitivity: "normal",
        consent: false,
        createdAt: now - 42 * MIN,
        draftId: "draft-seed-1",
      },
      {
        id: "obs-seed-2",
        authorId: "A",
        category: "risk",
        text: "来访者提到其母亲多次电话施压，要求其放弃现在的工作。",
        sensitivity: "relative",
        consent: false,
        createdAt: now - 38 * MIN,
        draftId: null,
      },
      {
        id: "obs-seed-3",
        authorId: "B",
        category: "intervention",
        text: "本次共同完成腹式呼吸放松练习，来访者表示可独立操作。",
        sensitivity: "normal",
        consent: false,
        createdAt: now - 30 * MIN,
        draftId: "draft-seed-2",
      },
      {
        id: "obs-seed-4",
        authorId: "B",
        category: "observation",
        text: "其部门主管在不知情的情况下被提及：已三次临时增加汇报场次。",
        sensitivity: "third_party",
        consent: false,
        createdAt: now - 24 * MIN,
        draftId: null,
      },
      {
        id: "obs-seed-5",
        authorId: "B",
        category: "goal",
        text: "下周目标：完成一次 5 分钟工作汇报预演并记录焦虑分值。",
        sensitivity: "normal",
        consent: false,
        createdAt: now - 16 * MIN,
        draftId: null,
      },
    ],
    drafts: [
      {
        id: "draft-seed-1",
        observationId: "obs-seed-1",
        authorId: "A",
        category: "observation",
        text: "来访者谈到本周睡眠略有改善，工作日能在 30 分钟内入睡。",
        sensitivity: "normal",
        consent: false,
        sharedAt: now - 40 * MIN,
        confirmed: { A: true, B: false },
        folded: false,
      },
      {
        id: "draft-seed-2",
        observationId: "obs-seed-3",
        authorId: "B",
        category: "intervention",
        text: "本次共同完成腹式呼吸放松练习，来访者表示可独立操作。",
        sensitivity: "normal",
        consent: false,
        sharedAt: now - 28 * MIN,
        confirmed: { A: true, B: true },
        folded: false,
      },
    ],
    versions: [],
  };
}
