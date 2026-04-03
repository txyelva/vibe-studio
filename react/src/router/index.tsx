import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import App from "../App";
import Dashboard from "../views/Dashboard";
import Projects from "../views/Projects";
import VibeChat from "../views/VibeChat";
import Settings from "../views/Settings";
import Onboarding from "../views/Onboarding";
import ProjectDetail from "../views/ProjectDetail";
import Models from "../views/Models";
import Login from "../views/Login";
import { authApi, getToken } from "../api/auth";
import { useStore } from "../store";

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setAuthenticated } = useStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (!token) {
        try {
          const status = await authApi.getStatus();
          if (!status.enabled) {
            setAuthenticated("anonymous");
          }
        } catch {
          // ignore and fall through to login
        } finally {
          setChecking(false);
        }
        return;
      }

      try {
        const user = await authApi.getMe(token);
        setAuthenticated(user.username);
      } catch {
        // token 无效，清除
        localStorage.removeItem("vibe_token");
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, [setAuthenticated]);

  if (checking) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "#0c0c0c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#6a6a6a", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// 公开路由（登录页）
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useStore();
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const RouterView = () => {
  const { setAuthenticated } = useStore();

  const handleLogin = () => {
    // 触发重新渲染，ProtectedRoute 会检测到 isAuthenticated 变化
    window.location.href = "/";
  };

  return (
    <Router>
      <Routes>
        {/* 登录页 */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login onLogin={handleLogin} />
            </PublicRoute>
          }
        />

        {/* 受保护的路由 */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="thread" element={<VibeChat />} />
          <Route path="projects/:projectId/thread" element={<VibeChat />} />
          <Route path="projects/:projectId/thread/:threadId" element={<VibeChat />} />
          <Route path="models" element={<Models />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Setup 页面也受保护 */}
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        {/* 未匹配路由重定向到登录 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};
