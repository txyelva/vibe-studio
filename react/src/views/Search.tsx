import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../api";
import { useStore } from "../store";
import type { SearchResult } from "../types";

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProjectId, openFile, switchProject, projects, config } = useStore();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [scope, setScope] = useState(searchParams.get("path") || ".");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  );

  useEffect(() => {
    const nextQuery = searchParams.get("q") || "";
    const nextScope = searchParams.get("path") || ".";
    setQuery(nextQuery);
    setScope(nextScope);
  }, [searchParams]);

  useEffect(() => {
    if (!query.trim()) return;
    void handleSearch(query, scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(forcedQuery?: string, forcedScope?: string) {
    const q = (forcedQuery ?? query).trim();
    const searchScope = (forcedScope ?? scope).trim() || ".";
    if (!q) return;
    setLoading(true);
    setError("");
    setSearched(true);
    setSearchParams({ q, path: searchScope });
    try {
      const response = await api.searchWorkspace(q, searchScope);
      setResults(response.results);
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(result: SearchResult) {
    if (currentProjectId) {
      await switchProject(currentProjectId);
      navigate(`/projects/${currentProjectId}/thread`);
    } else {
      navigate("/thread");
    }
    await openFile(result.path);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", backgroundColor: "#080808", borderBottom: "1px solid #2f2f2f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 16, height: 16, backgroundImage: "url(/images/search.png)", backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>Search</span>
        </div>
        <div style={{ fontSize: 11, color: "#6a6a6a" }}>
          {currentProject ? currentProject.name : (config?.workspace || "Current workspace")}
        </div>
      </div>

      <div style={{ padding: 24, borderBottom: "1px solid #1c1c1c", backgroundColor: "#0c0c0c", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
            placeholder="搜索代码、变量、报错、函数名"
            style={{ flex: 1, minWidth: 280, padding: "10px 12px", backgroundColor: "#141414", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }}
          />
          <input
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="子目录范围，默认 ."
            style={{ width: 220, padding: "10px 12px", backgroundColor: "#141414", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }}
          />
          <button
            onClick={() => void handleSearch()}
            disabled={loading || !query.trim()}
            style={{ padding: "10px 16px", backgroundColor: "#00ff88", border: "none", color: "#0c0c0c", fontWeight: "bold", fontSize: 13, cursor: "pointer", opacity: loading || !query.trim() ? 0.5 : 1, fontFamily: "inherit" }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#6a6a6a" }}>
          先在项目里拉证据，再回到任务里继续推进。
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {error && <div style={{ marginBottom: 16, color: "#ff6666", fontSize: 12 }}>{error}</div>}

        {!searched ? (
          <div style={{ color: "#6a6a6a", fontSize: 13 }}>输入关键词开始搜索。</div>
        ) : loading ? (
          <div style={{ color: "#6a6a6a", fontSize: 13 }}>搜索中...</div>
        ) : results.length === 0 ? (
          <div style={{ color: "#6a6a6a", fontSize: 13 }}>没有找到匹配结果。</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {results.map((result, index) => (
              <button
                key={`${result.path}:${result.line}:${result.column}:${index}`}
                onClick={() => void handleOpen(result)}
                style={{
                  textAlign: "left",
                  padding: 16,
                  backgroundColor: "#141414",
                  border: "1px solid #2f2f2f",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontSize: 12, color: "#00ff88", wordBreak: "break-all" }}>{result.path}</div>
                  <div style={{ fontSize: 11, color: "#6a6a6a", whiteSpace: "nowrap" }}>
                    L{result.line}:C{result.column}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#cfcfcf", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {result.preview}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
