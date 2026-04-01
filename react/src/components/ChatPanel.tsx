import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStore } from "../store";
import type { AgentEvent, ChatMessage } from "../types";

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

function MessageItem({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const hasFileChanges = (msg.fileChanges && msg.fileChanges.length > 0) || false;

  if (isUser) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#6a6a6a" }}>{formatTime()}</span>
          <span style={{ fontSize: 12, fontWeight: "bold", color: "#8a8a8a" }}>You</span>
        </div>
        <div
          style={{
            maxWidth: "80%",
            padding: "12px 16px",
            backgroundColor: "#141414",
            border: "1px solid #3f3f3f",
            color: "#fff",
            fontSize: 13,
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
      <div style={{ maxWidth: "85%", paddingLeft: 42 }}>
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

const SUGGESTIONS = ["帮我分析这个项目的结构", "帮我写一个 README", "找出代码中的 bug", "帮我重构这个函数"];

export default function ChatPanel() {
  const { messages, isAgentRunning, sendMessage, wsConnected, currentConversationId, createConversation } = useStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentRunning]);

  useEffect(() => {
    if (!currentConversationId) {
      void createConversation();
    }
  }, [currentConversationId, createConversation]);

  function handleSend() {
    const text = input.trim();
    if (!text || isAgentRunning) return;
    setInput("");
    sendMessage(text);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 520 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#141414",
                    border: "1px solid #2f2f2f",
                    color: "#8a8a8a",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
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
      <div style={{ padding: "16px 40px", borderTop: "1px solid #2f2f2f", backgroundColor: "#080808" }}>
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
  );
}
