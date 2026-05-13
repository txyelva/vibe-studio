import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useStore } from "../store";

const STATUS_OPTIONS = ["all", "idle", "running", "done", "failed", "archived"] as const;
const MODE_OPTIONS = ["ask", "inspect", "fix", "review", "refactor"] as const;

function formatRelative(dateString?: string | null) {
  if (!dateString) return "未运行";
  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusColor(status: string) {
  switch (status) {
    case "running":
      return "#00ff88";
    case "done":
      return "#6ac6ff";
    case "failed":
      return "#ff6666";
    case "archived":
      return "#8a8a8a";
    default:
      return "#ffcc66";
  }
}

export default function Tasks() {
  const navigate = useNavigate();
  const { tasks, loadingTasks, projects, currentProjectId, config, loadTasks, createTask } = useStore();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [modeFilter, setModeFilter] = useState<"all" | (typeof MODE_OPTIONS)[number]>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    task_mode: "fix",
    model: config?.primary_model || "",
  });

  useEffect(() => {
    void loadTasks(currentProjectId ?? undefined);
  }, [loadTasks, currentProjectId]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, model: config?.primary_model || prev.model }));
  }, [config?.primary_model]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (modeFilter !== "all" && task.task_mode !== modeFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, modeFilter]);

  const allModels: Array<{ ref: string; label: string }> = [];
  for (const [pid, pc] of Object.entries(config?.providers ?? {})) {
    for (const m of pc.models) {
      allModels.push({ ref: `${pid}/${m.id}`, label: `${pc.name} / ${m.name}` });
    }
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const project = projects.find((item) => item.id === currentProjectId);
      const taskId = await createTask({
        title: form.title.trim(),
        project_id: currentProjectId ?? undefined,
        workspace: project?.path ?? config?.workspace,
        model: form.model || config?.primary_model,
        task_mode: form.task_mode,
      });
      if (taskId) {
        setShowCreate(false);
        setForm({ title: "", task_mode: "fix", model: config?.primary_model || "" });
        navigate(currentProjectId ? `/projects/${currentProjectId}/thread/${taskId}` : `/thread/${taskId}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", backgroundColor: "#080808", borderBottom: "1px solid #2f2f2f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 16, height: 16, backgroundImage: "url(/images/messagesquare.png)", backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>Tasks</span>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: "8px 14px", backgroundColor: "#00ff88", border: "none", color: "#0c0c0c", fontSize: 12, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit" }}>
          + New Task
        </button>
      </div>

      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1c1c1c", display: "flex", gap: 12, flexWrap: "wrap", backgroundColor: "#0c0c0c" }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number])} style={{ padding: "8px 10px", backgroundColor: "#141414", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 12 }}>
          {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item === "all" ? "All Status" : item}</option>)}
        </select>
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as "all" | (typeof MODE_OPTIONS)[number])} style={{ padding: "8px 10px", backgroundColor: "#141414", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 12 }}>
          <option value="all">All Modes</option>
          {MODE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {loadingTasks ? (
          <div style={{ color: "#6a6a6a", fontSize: 13 }}>Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ color: "#6a6a6a", fontSize: 13 }}>No tasks yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {filteredTasks.map((task) => {
              const project = projects.find((item) => item.id === task.project_id);
              return (
                <button
                  key={task.id}
                  onClick={() => navigate(task.project_id ? `/projects/${task.project_id}/thread/${task.id}` : `/thread/${task.id}`)}
                  style={{
                    textAlign: "left",
                    padding: 20,
                    backgroundColor: "#141414",
                    border: "1px solid #2f2f2f",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff", lineHeight: 1.4 }}>{task.title}</div>
                    <span style={{ fontSize: 10, color: statusColor(task.status), border: `1px solid ${statusColor(task.status)}`, padding: "3px 8px" }}>{task.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "#ffcc66", border: "1px solid rgba(255,204,102,0.35)", padding: "3px 8px" }}>{task.task_mode}</span>
                    {project && <span style={{ fontSize: 10, color: "#8a8a8a", border: "1px solid #2f2f2f", padding: "3px 8px" }}>{project.name}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#b6b6b6", lineHeight: 1.6 }}>
                    {task.summary || "还没有执行摘要，适合从这里继续推进。"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6a6a6a" }}>
                    <span>{task.changed_files.length} files changed</span>
                    <span>{formatRelative(task.last_run_at || task.updated_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowCreate(false)}>
          <div style={{ width: 520, maxWidth: "92vw", backgroundColor: "#141414", border: "1px solid #2f2f2f", padding: 24, display: "flex", flexDirection: "column", gap: 14 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>New Task</div>
            <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="例如：修复登录状态闪烁" style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }} />
            <select value={form.task_mode} onChange={(e) => setForm((prev) => ({ ...prev, task_mode: e.target.value }))} style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }}>
              {MODE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }}>
              <option value="">-- 选择模型 --</option>
              {allModels.map((item) => <option key={item.ref} value={item.ref}>{item.label}</option>)}
            </select>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: "10px 16px", backgroundColor: "transparent", border: "1px solid #2f2f2f", color: "#8a8a8a", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => void handleCreate()} disabled={creating || !form.title.trim()} style={{ padding: "10px 16px", backgroundColor: "#00ff88", border: "none", color: "#0c0c0c", fontWeight: "bold", fontSize: 13, cursor: "pointer", opacity: creating || !form.title.trim() ? 0.5 : 1, fontFamily: "inherit" }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
