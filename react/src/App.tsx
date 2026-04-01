import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";

function App() {
  const { loadConfig, loadingConfig, showOnboarding } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (showOnboarding) {
      navigate("/setup", { replace: true });
    }
  }, [showOnboarding, navigate]);

  if (loadingConfig) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#0c0c0c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6a6a6a",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "2px solid #2f2f2f",
              borderTopColor: "#00ff88",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <span style={{ fontSize: 13 }}>启动中...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0c0c0c",
        display: "flex",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <Outlet />
      </div>
    </div>
  );
}

export default App;
