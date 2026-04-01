import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate, useParams } from "react-router";
import { useStore } from "../store";
import { useMobile } from "../hooks/useMobile";
import type { AgentEvent, ChatMessage, Conversation } from "../types";

function getToolLabel(name: string) {
  const labels: Record<string, string> = {
    read_file: "读取文件",
    write_file: "写入文件",
    str_replace: "修改文件",
    list_files: "浏览目录",
    search_files: "搜索内容",
    bash_exec: "执行命令",
  };
  return labels[name] || name;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

// Markdown components for ReactMarkdown
const markdownComponents = {
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).trim();
    if (!inline && match) {
      return <CodeBlock language={match[1]} code={code} />;
    }
    if (!inline && code.includes("\n")) {
      return <CodeBlock language="text" code={code} />;
    }
    return (
      <code
        style={{
          backgroundColor: "#1a1a1a",
          padding: "2px 6px",
          borderRadius: 3,
          fontSize: 12,
          color: "#00ff88",
          fontFamily: "'JetBrains Mono', monospace",
        }}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre({ children }: any) {
    return <>{children}</>;
  },
  h1({ children }: any) {
    return <h1 style={{ fontSize: 20, fontWeight: "bold", color: "#fff", margin: "16px 0 12px", borderBottom: "1px solid #2f2f2f", paddingBottom: 8 }}>{children}</h1>;
  },
  h2({ children }: any) {
    return <h2 style={{ fontSize: 18, fontWeight: "bold", color: "#fff", margin: "14px 0 10px", borderBottom: "1px solid #2f2f2f", paddingBottom: 6 }}>{children}</h2>;
  },
  h3({ children }: any) {
    return <h3 style={{ fontSize: 16, fontWeight: "bold", color: "#fff", margin: "12px 0 8px" }}>{children}</h3>;
  },
  h4({ children }: any) {
    return <h4 style={{ fontSize: 14, fontWeight: "bold", color: "#fff", margin: "10px 0 6px" }}>{children}</h4>;
  },
  h5({ children }: any) {
    return <h5 style={{ fontSize: 13, fontWeight: "bold", color: "#fff", margin: "8px 0 4px" }}>{children}</h5>;
  },
  h6({ children }: any) {
    return <h6 style={{ fontSize: 12, fontWeight: "bold", color: "#6a6a6a", margin: "8px 0 4px" }}>{children}</h6>;
  },
  p({ children }: any) {
    return <p style={{ fontSize: 13, color: "#fff", lineHeight: "1.7", margin: "8px 0" }}>{children}</p>;
  },
  ul({ children }: any) {
    return <ul style={{ paddingLeft: 20, margin: "8px 0", color: "#fff" }}>{children}</ul>;
  },
  ol({ children }: any) {
    return <ol style={{ paddingLeft: 20, margin: "8px 0", color: "#fff" }}>{children}</ol>;
  },
  li({ children }: any) {
    return <li style={{ fontSize: 13, lineHeight: "1.7", margin: "4px 0" }}>{children}</li>;
  },
  strong({ children }: any) {
    return <strong style={{ color: "#fff", fontWeight: "bold" }}>{children}</strong>;
  },
  em({ children }: any) {
    return <em style={{ color: "#aaa", fontStyle: "italic" }}>{children}</em>;
  },
  a({ href, children }: any) {
    return <a href={href} style={{ color: "#00ff88", textDecoration: "underline" }} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
  blockquote({ children }: any) {
    return (
      <blockquote style={{ borderLeft: "3px solid #00ff88", paddingLeft: 12, margin: "12px 0", color: "#aaa", fontStyle: "italic" }}>
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr style={{ border: "none", borderTop: "1px solid #2f2f2f", margin: "16px 0" }} />;
  },
  table({ children }: any) {
    return <table style={{ width: "100%", borderCollapse: "collapse", margin: "12px 0", fontSize: 12 }}>{children}</table>;
  },
  thead({ children }: any) {
    return <thead style={{ backgroundColor: "#1a1a1a" }}>{children}</thead>;
  },
  tbody({ children }: any) {
    return <tbody>{children}</tbody>;
  },
  tr({ children }: any) {
    return <tr style={{ borderBottom: "1px solid #2f2f2f" }}>{children}</tr>;
  },
  th({ children }: any) {
    return <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: "bold", color: "#fff", borderBottom: "2px solid #2f2f2f" }}>{children}</th>;
  },
  td({ children }: any) {
    return <td style={{ padding: "8px 12px", color: "#ccc", borderBottom: "1px solid #2f2f2f" }}>{children}</td>;
  },
};

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 10, border: "1px solid #3f3f3f" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          backgroundColor: "#1a1a1a",
          borderBottom: "1px solid #3f3f3f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundImage: "url(/images/filecode.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
          <span style={{ fontSize: 11, color: "#00ff88" }}>{language}</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          style={{
            fontSize: 10,
            color: copied ? "#00ff88" : "#8a8a8a",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: "bold",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "12px 16px",
          backgroundColor: "#141414",
          color: "#fff",
          fontSize: 12,
          lineHeight: "1.5",
          overflowX: "auto",
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: "pre",
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FileChangeBadge({ path, isNew, isDeleted }: { path: string; isNew?: boolean; isDeleted?: boolean }) {
  if (isDeleted) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6a6a6a" }}>
        <span>- {path}</span>
        <span style={{ padding: "2px 8px", backgroundColor: "#1a1a1a", color: "#6a6a6a", fontSize: 10 }}>Deleted</span>
      </div>
    );
  }
  if (isNew) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#00ff88" }}>
        <span>+ {path}</span>
        <span style={{ padding: "2px 8px", backgroundColor: "rgba(0,255,136,0.1)", color: "#00ff88", fontSize: 10 }}>Created</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#ff8800" }}>
      <span>~ {path}</span>
      <span style={{ padding: "2px 8px", backgroundColor: "rgba(255,136,0,0.1)", color: "#ff8800", fontSize: 10 }}>Modified</span>
    </div>
  );
}

function ToolCallItem({ event }: { event: AgentEvent }) {
  if (event.type === "tool_start") {
    let detail = "";
    if (event.name === "bash_exec" && event.args.command) detail = String(event.args.command);
    else if (event.args.path) detail = String(event.args.path);
    return (
      <div style={{ marginTop: 6, padding: "6px 10px", backgroundColor: "#0c0c0c", border: "1px solid #1a1a1a", fontSize: 10, color: "#6a6a6a" }}>
        <span style={{ color: "#00ff88" }}>{getToolLabel(event.name)}</span>
        {detail && <span style={{ marginLeft: 6 }}>{detail}</span>}
      </div>
    );
  }
  if (event.type === "tool_end") {
    const hasError = typeof event.result === "object" && event.result !== null && "error" in event.result;
    const resultText = hasError
      ? String((event.result as any).error)
      : (event.result as any).exit_code != null
      ? `exit: ${String((event.result as any).exit_code)}`
      : "完成";
    return (
      <div style={{ marginLeft: 8, padding: "4px 10px", fontSize: 10, color: hasError ? "#ff4444" : "#6a6a6a", borderLeft: `2px solid ${hasError ? "#ff4444" : "#00ff88"}` }}>
        {resultText}
      </div>
    );
  }
  if (event.type === "file_changed") {
    return (
      <div style={{ marginTop: 6, padding: "6px 10px", backgroundColor: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.15)", fontSize: 10, color: "#00ff88" }}>
        已更新 {event.path}
      </div>
    );
  }
  return null;
}

function MessageItem({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const hasFileChanges = (msg.fileChanges && msg.fileChanges.length > 0) || false;
  const isMobile = useMobile(768);

  if (isUser) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#6a6a6a" }}>{formatTime()}</span>
          <span style={{ fontSize: 12, fontWeight: "bold", color: "#8a8a8a" }}>You</span>
        </div>
        <div
          style={{
            maxWidth: isMobile ? "90%" : "80%",
            padding: isMobile ? "10px 14px" : "12px 16px",
            backgroundColor: "#141414",
            border: "1px solid #3f3f3f",
            color: "#fff",
            fontSize: isMobile ? 15 : 13,
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: isMobile ? 28 : 32,
            height: isMobile ? 28 : 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,255,136,0.08)",
            border: "1px solid rgba(0,255,136,0.3)",
            fontSize: 10,
            color: "#00ff88",
            fontWeight: "bold",
          }}
        >
          AI
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: isMobile ? 13 : 12, fontWeight: "bold", color: "#00ff88" }}>Agent</span>
          <span style={{ fontSize: 11, color: "#6a6a6a" }}>{formatTime()}</span>
        </div>
      </div>
      <div style={{ maxWidth: isMobile ? "95%" : "85%", paddingLeft: isMobile ? 0 : 42, width: "100%" }}>
        <div
          style={{
            padding: "16px 20px",
            backgroundColor: "#0a0a0a",
            border: "1px solid #2f2f2f",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {msg.events?.filter((e) => e.type === "tool_start" || e.type === "tool_end" || e.type === "file_changed").map((e, i) => <ToolCallItem key={i} event={e} />)}

          <div style={{ fontSize: 13, color: "#fff", lineHeight: "1.6" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {msg.content}
            </ReactMarkdown>
          </div>

          {hasFileChanges && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {msg.fileChanges?.map((fc, i) => (
                <FileChangeBadge
                  key={i}
                  path={fc.path}
                  isNew={fc.old_content == null}
                  isDeleted={fc.new_content == null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,255,136,0.08)",
            border: "1px solid rgba(0,255,136,0.3)",
            fontSize: 10,
            color: "#00ff88",
            fontWeight: "bold",
          }}
        >
          AI
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 12, fontWeight: "bold", color: "#00ff88" }}>Agent</span>
          <span style={{ fontSize: 11, color: "#6a6a6a" }}>{formatTime()}</span>
        </div>
      </div>
      <div style={{ paddingLeft: 42 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            backgroundColor: "rgba(0,255,136,0.06)",
            border: "1px solid rgba(0,255,136,0.2)",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              backgroundImage: "url(/images/loader.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              animation: "spin 1s linear infinite",
            }}
          />
          <span style={{ fontSize: 12, color: "#00ff88" }}>Thinking...</span>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Thread list item with edit functionality
function ThreadListItem({
  conv,
  isActive,
  onClick,
  onDelete,
  onUpdateTitle,
}: {
  conv: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conv.title);

  const handleSave = async () => {
    if (editTitle.trim() && editTitle !== conv.title) {
      await onUpdateTitle(conv.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        style={{
          padding: "10px 16px",
          backgroundColor: "#141414",
          borderBottom: "1px solid #2f2f2f",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
          autoFocus
          style={{
            padding: "6px 10px",
            backgroundColor: "#0c0c0c",
            border: "1px solid #00ff88",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 12,
            width: "100%",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSave}
            style={{
              padding: "4px 10px",
              backgroundColor: "#00ff88",
              border: "none",
              color: "#0c0c0c",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "bold",
            }}
          >
            保存
          </button>
          <button
            onClick={() => setIsEditing(false)}
            style={{
              padding: "4px 10px",
              backgroundColor: "transparent",
              border: "1px solid #2f2f2f",
              color: "#8a8a8a",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 16px",
        backgroundColor: isActive ? "#141414" : "transparent",
        borderBottom: "1px solid #2f2f2f",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isActive ? "#fff" : "#8a8a8a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
          title={conv.title}
        >
          {conv.title}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            style={{
              fontSize: 11,
              color: "#00ff88",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: 0.6,
              padding: "2px 6px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
          >
            ✎
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`确定删除 "${conv.title}" 吗？`)) onDelete();
            }}
            style={{
              fontSize: 11,
              color: "#ff4444",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: 0.6,
              padding: "2px 6px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
          >
            ×
          </button>
        </div>
      </div>
      <span style={{ fontSize: 10, color: isActive ? "#00ff88" : "#6a6a6a" }}>
        {formatDate(conv.updated_at)} · {conv.message_count || 0} 条消息
      </span>
    </div>
  );
}

const SUGGESTIONS = ["帮我分析这个项目的结构", "帮我写一个 README", "找出代码中的 bug", "帮我重构这个函数"];

// 模型选择对话框组件
function ModelSelectDialog({
  isOpen,
  onClose,
  onSelect,
  providers,
  primaryModel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (model: string) => void;
  providers: Record<string, { name: string; models: Array<{ id: string; name: string }> }>;
  primaryModel: string;
}) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  
  if (!isOpen) return null;
  
  // 获取所有可用模型
  const allModels: Array<{ provider: string; providerName: string; modelId: string; modelName: string }> = [];
  Object.entries(providers).forEach(([pid, p]) => {
    p.models.forEach((m) => {
      allModels.push({
        provider: pid,
        providerName: p.name,
        modelId: m.id,
        modelName: m.name,
      });
    });
  });
  
  // 按 provider 分组
  const modelsByProvider = allModels.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, typeof allModels>);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 480,
          maxHeight: "80vh",
          backgroundColor: "#141414",
          border: "1px solid #2f2f2f",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #2f2f2f" }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#fff" }}>选择模型</div>
          <div style={{ fontSize: 12, color: "#6a6a6a", marginTop: 4 }}>
            选择要使用的 AI 模型，默认使用主模型
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {/* 主模型选项 */}
          <button
            onClick={() => onSelect("")}
            style={{
              width: "100%",
              padding: "12px 16px",
              backgroundColor: primaryModel === "" ? "rgba(0,255,136,0.1)" : "transparent",
              border: "1px solid #2f2f2f",
              color: "#fff",
              textAlign: "left",
              cursor: "pointer",
              marginBottom: 12,
              fontFamily: "inherit",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: "bold" }}>🌟 使用主模型 (默认)</div>
            <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 4 }}>{primaryModel || "未设置"}</div>
          </button>
          
          {/* 按 provider 分组的模型 */}
          {Object.entries(modelsByProvider).map(([pid, models]) => (
            <div key={pid} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#6a6a6a", padding: "8px 4px", textTransform: "uppercase" }}>
                {providers[pid]?.name || pid}
              </div>
              {models.map((m) => (
                <button
                  key={`${m.provider}/${m.modelId}`}
                  onClick={() => onSelect(`${m.provider}/${m.modelId}`)}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    backgroundColor: "transparent",
                    border: "none",
                    borderBottom: "1px solid #1a1a1a",
                    color: "#ccc",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#1a1a1a";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#ccc";
                  }}
                >
                  {m.modelName}
                  <span style={{ fontSize: 10, color: "#6a6a6a", marginLeft: 8 }}>({m.modelId})</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        
        <div style={{ padding: "12px 20px", borderTop: "1px solid #2f2f2f", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              border: "1px solid #2f2f2f",
              color: "#8a8a8a",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VibeChat() {
  const params = useParams<{ projectId?: string; threadId?: string }>();
  const projectId = params.projectId;
  const threadId = params.threadId;
  const navigate = useNavigate();
  const isMobile = useMobile(768);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showModelDialog, setShowModelDialog] = useState(false);
  
  const {
    messages,
    isAgentRunning,
    sendMessage,
    clearChat,
    wsConnected,
    config,
    currentConversationId,
    createConversation,
    loadConversation,
    conversations,
    loadConversations,
    deleteConversation,
    updateConversationTitle,
    projects,
    currentProjectId,
    switchProject,
  } = useStore();
  
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 确定当前项目
  const effectiveProjectId = projectId || currentProjectId;
  const currentProject = projects.find((p) => p.id === effectiveProjectId);

  // 加载项目对应的对话列表
  useEffect(() => {
    if (effectiveProjectId) {
      void loadConversations(effectiveProjectId);
    } else {
      void loadConversations();
    }
  }, [effectiveProjectId, loadConversations]);

  // 如果 URL 中有 threadId，加载对应对话
  useEffect(() => {
    if (threadId && threadId !== currentConversationId) {
      void loadConversation(threadId);
    }
  }, [threadId, currentConversationId, loadConversation]);

  // 如果没有当前对话且 URL 中没有 threadId，自动创建或选中第一个
  useEffect(() => {
    if (!currentConversationId && !isCreating && effectiveProjectId && !threadId) {
      // 如果有对话列表，选中第一个
      if (conversations.length > 0) {
        void handleSwitchConversation(conversations[0].id);
      } else {
        // 没有对话则创建新的
        setIsCreating(true);
        void createConversation(effectiveProjectId).finally(() => setIsCreating(false));
      }
    }
  }, [currentConversationId, conversations.length, effectiveProjectId, createConversation, isCreating, threadId]);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentRunning]);

  // 切换对话
  const handleSwitchConversation = async (id: string) => {
    await loadConversation(id);
    // 更新 URL 包含 threadId
    if (projectId) {
      navigate(`/projects/${projectId}/thread/${id}`, { replace: true });
    }
  };

  // 新建对话 - 显示模型选择对话框
  const handleCreateConversation = () => {
    setShowModelDialog(true);
  };
  
  // 创建对话并指定模型
  const handleCreateWithModel = async (model: string) => {
    setShowModelDialog(false);
    setIsCreating(true);
    let newId: string | undefined;
    try {
      if (effectiveProjectId) {
        newId = await createConversation(effectiveProjectId, model || undefined);
      } else {
        newId = await createConversation(undefined, model || undefined);
      }
      // 更新 URL 到新对话
      if (newId && projectId) {
        navigate(`/projects/${projectId}/thread/${newId}`, { replace: true });
      }
    } finally {
      setIsCreating(false);
    }
  };

  // 发送消息
  const handleSend = () => {
    const text = input.trim();
    if (!text || isAgentRunning) return;
    setInput("");
    sendMessage(text);
  };

  // 当前对话
  const currentConv = conversations.find((c) => c.id === currentConversationId);
  const threadTitle = currentConv?.title || currentProject?.name || "Thread";
  
  // 获取当前显示的模型名称
  const getCurrentModelDisplay = () => {
    if (currentConv?.model) {
      const [pid, mid] = currentConv.model.split("/");
      const provider = config?.providers?.[pid];
      const modelInfo = provider?.models?.find((m) => m.id === mid);
      return { name: modelInfo?.name || mid, provider: provider?.name || pid, isCustom: true };
    }
    if (config?.primary_model) {
      const [pid, mid] = config.primary_model.split("/");
      const provider = config?.providers?.[pid];
      const modelInfo = provider?.models?.find((m) => m.id === mid);
      return { name: modelInfo?.name || mid, provider: provider?.name || pid, isCustom: false };
    }
    return { name: "未配置", provider: "", isCustom: false };
  };
  const currentModelDisplay = getCurrentModelDisplay();

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", position: "relative" }}>
      {/* 模型选择对话框 */}
      <ModelSelectDialog
        isOpen={showModelDialog}
        onClose={() => setShowModelDialog(false)}
        onSelect={handleCreateWithModel}
        providers={config?.providers || {}}
        primaryModel={config?.primary_model || ""}
      />
      {/* Mobile Sidebar Toggle */}
      {isMobile && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 101,
            width: 40,
            height: 40,
            backgroundColor: "#141414",
            border: "1px solid #2f2f2f",
            color: "#fff",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showSidebar ? "✕" : "☰"}
        </button>
      )}

      {/* Left Sidebar - Thread List */}
      <div
        style={{
          width: isMobile ? (showSidebar ? "100%" : 0) : 280,
          height: "100%",
          backgroundColor: "#080808",
          borderRight: isMobile ? "none" : "1px solid #2f2f2f",
          display: isMobile && !showSidebar ? "none" : "flex",
          flexDirection: "column",
          fontFamily: "'JetBrains Mono', monospace",
          position: isMobile ? "absolute" : "relative",
          zIndex: 100,
          left: 0,
          top: 0,
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 20px",
            borderBottom: "1px solid #2f2f2f",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              backgroundImage: "url(/images/terminal3.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff", letterSpacing: 0.5 }}>
              {currentProject?.name || "VIBE STUDIO"}
            </div>
            <div style={{ fontSize: 10, color: "#6a6a6a" }}>
              {currentProject ? currentProject.model.split("/").pop() : "v0.1.0"}
            </div>
          </div>
        </div>

        {/* Back to Projects */}
        <button
          onClick={() => navigate("/projects")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 20px",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid #2f2f2f",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              backgroundImage: "url(/images/arrowleft.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              opacity: 0.7,
            }}
          />
          <span style={{ fontSize: 12, color: "#8a8a8a", letterSpacing: 0.3 }}>Back to Projects</span>
        </button>

        {/* Thread List Header */}
        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #2f2f2f",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: "bold",
              color: "#6a6a6a",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            Threads
          </span>
          <button
            onClick={handleCreateConversation}
            disabled={isCreating}
            style={{
              padding: "4px 10px",
              backgroundColor: "transparent",
              border: "1px solid #2f2f2f",
              color: "#00ff88",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + New
          </button>
        </div>

        {/* Thread List */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6a6a6a", fontSize: 12 }}>
              暂无对话
              <br />
              <button
                onClick={handleCreateConversation}
                style={{
                  marginTop: 10,
                  padding: "6px 12px",
                  backgroundColor: "#00ff88",
                  border: "none",
                  color: "#0c0c0c",
                  fontSize: 11,
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                新建 Thread
              </button>
            </div>
          ) : (
            conversations.map((conv) => (
              <ThreadListItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === currentConversationId}
                onClick={() => handleSwitchConversation(conv.id)}
                onDelete={() => void deleteConversation(conv.id)}
                onUpdateTitle={updateConversationTitle}
              />
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #2f2f2f",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 10, color: "#6a6a6a" }}>Connection</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: wsConnected ? "#00ff88" : "#6a6a6a" }} />
            <span style={{ fontSize: 11, color: wsConnected ? "#8a8a8a" : "#6a6a6a" }}>{wsConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", backgroundColor: "#0c0c0c" }}>
        {/* Main Header */}
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "0 16px 0 60px" : "0 32px",
            backgroundColor: "#080808",
            borderBottom: "1px solid #2f2f2f",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {threadTitle}
            </div>
            <div style={{ fontSize: 11, color: "#6a6a6a", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: currentModelDisplay.isCustom ? "#ffaa00" : "#6a6a6a" }}>
                {currentModelDisplay.isCustom ? "⚡ " : ""}{currentModelDisplay.name}
              </span>
              <span>·</span>
              <span>{currentModelDisplay.provider}</span>
              {currentProject?.path && (
                <>
                  <span>·</span>
                  <span>{currentProject.path}</span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                backgroundColor: "rgba(0,255,136,0.08)",
                border: "1px solid rgba(0,255,136,0.3)",
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#00ff88" }} />
              <span style={{ fontSize: 10, fontWeight: "bold", color: "#00ff88" }}>Live</span>
            </div>
            <button
              onClick={clearChat}
              style={{
                padding: "6px 12px",
                backgroundColor: "transparent",
                border: "1px solid #2f2f2f",
                color: "#8a8a8a",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              清空
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px" : "32px 40px" }}>
          {messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,255,136,0.08)",
                  border: "1px solid rgba(0,255,136,0.2)",
                  fontSize: 20,
                  color: "#00ff88",
                  fontWeight: "bold",
                }}
              >
                AI
              </div>
              <p style={{ color: "#8a8a8a", fontSize: 14 }}>开始对话，让 AI 帮你写代码</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 520, padding: isMobile ? "0 8px" : 0 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    style={{
                      padding: isMobile ? "12px 16px" : "10px 16px",
                      backgroundColor: "#141414",
                      border: "1px solid #2f2f2f",
                      color: "#8a8a8a",
                      fontSize: isMobile ? 14 : 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      flex: isMobile ? "1 1 calc(50% - 10px)" : "none",
                      minWidth: isMobile ? 120 : "auto",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {messages.map((msg) => (
                <MessageItem key={msg.id} msg={msg} />
              ))}
              {isAgentRunning && <ThinkingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: isMobile ? "12px 16px" : "16px 40px", borderTop: "1px solid #2f2f2f", backgroundColor: "#080808" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              backgroundColor: "#0a0a0a",
              border: "1px solid #00ff88",
            }}
          >
            <div
              style={{
                width: 15,
                height: 15,
                backgroundImage: "url(/images/messagesquare.png)",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                opacity: 0.6,
              }}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={wsConnected ? "描述你想做什么..." : "等待连接..."}
              disabled={isAgentRunning || !wsConnected}
              rows={1}
              style={{
                flex: 1,
                minHeight: 20,
                maxHeight: 120,
                padding: 0,
                backgroundColor: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 13,
                fontFamily: "inherit",
                resize: "none",
                outline: "none",
                lineHeight: "1.5",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isAgentRunning || !wsConnected}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                backgroundColor: "#00ff88",
                border: "none",
                color: "#0c0c0c",
                fontSize: 12,
                fontWeight: "bold",
                letterSpacing: 0.5,
                cursor: input.trim() && !isAgentRunning && wsConnected ? "pointer" : "not-allowed",
                opacity: input.trim() && !isAgentRunning && wsConnected ? 1 : 0.5,
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  width: 13,
                  height: 13,
                  backgroundImage: "url(/images/send.png)",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                }}
              />
              Send
            </button>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
              fontSize: 11,
              color: "#6a6a6a",
            }}
          >
            <span>Press Enter to send</span>
            <span>Shift + Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}
