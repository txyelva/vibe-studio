import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useStore } from "../store";
import { useMobile } from "../hooks/useMobile";

const MAIN_NAV_ITEMS = [
  { path: "/projects", label: "Projects", icon: "/images/folder2.png" },
  { path: "/models", label: "Models", icon: "/images/terminal3.png" },
];

const FOOTER_NAV_ITEMS = [
  { path: "/settings", label: "Settings", icon: "/images/settings0.png" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, currentProjectId, username, logout } = useStore();
  const isMobile = useMobile(768);
  const [menuOpen, setMenuOpen] = useState(false);

  const threadPath = currentProjectId ? `/projects/${currentProjectId}/thread` : "/projects";

  const handleNavClick = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  // 移动端底部导航栏
  if (isMobile) {
    return (
      <>
        {/* 移动端顶部栏 */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 56,
            backgroundColor: "#080808",
            borderBottom: "1px solid #2f2f2f",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                backgroundImage: "url(/images/terminal3.png)",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
              }}
            />
            <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>
              VIBE STUDIO
            </span>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: 40,
              height: 40,
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* 移动端菜单遮罩 */}
        {menuOpen && (
          <div
            style={{
              position: "fixed",
              top: 56,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.8)",
              zIndex: 99,
            }}
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* 移动端菜单 */}
        {menuOpen && (
          <div
            style={{
              position: "fixed",
              top: 56,
              left: 0,
              right: 0,
              backgroundColor: "#141414",
              borderBottom: "1px solid #2f2f2f",
              zIndex: 100,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {MAIN_NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    backgroundColor: isActive ? "rgba(0,255,136,0.1)" : "transparent",
                    border: "none",
                    borderLeft: isActive ? "3px solid #00ff88" : "3px solid transparent",
                    color: isActive ? "#00ff88" : "#8a8a8a",
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      backgroundImage: `url(${item.icon})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      opacity: isActive ? 1 : 0.7,
                    }}
                  />
                  {item.label}
                </button>
              );
            })}

            {/* Thread */}
            <button
              onClick={() => handleNavClick(threadPath)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                backgroundColor:
                  location.pathname.startsWith("/projects/") || location.pathname === "/thread"
                    ? "rgba(0,255,136,0.1)"
                    : "transparent",
                border: "none",
                borderLeft:
                  location.pathname.startsWith("/projects/") || location.pathname === "/thread"
                    ? "3px solid #00ff88"
                    : "3px solid transparent",
                color:
                  location.pathname.startsWith("/projects/") || location.pathname === "/thread"
                    ? "#00ff88"
                    : "#8a8a8a",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  backgroundImage: "url(/images/messagesquare.png)",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  opacity:
                    location.pathname.startsWith("/projects/") || location.pathname === "/thread"
                      ? 1
                      : 0.7,
                }}
              />
              Thread
            </button>

            {FOOTER_NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    backgroundColor: isActive ? "rgba(0,255,136,0.1)" : "transparent",
                    border: "none",
                    borderLeft: isActive ? "3px solid #00ff88" : "3px solid transparent",
                    color: isActive ? "#00ff88" : "#8a8a8a",
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      backgroundImage: `url(${item.icon})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      opacity: isActive ? 1 : 0.7,
                    }}
                  />
                  {item.label}
                </button>
              );
            })}

            {/* 用户信息 */}
            {username && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid #2f2f2f",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "#00ff88",
                    }}
                  />
                  <span style={{ fontSize: 13, color: "#8a8a8a" }}>{username}</span>
                </div>
                <button
                  onClick={logout}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "transparent",
                    border: "1px solid #2f2f2f",
                    color: "#8a8a8a",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}

        {/* 占位符，避免内容被顶部栏遮挡 */}
        <div style={{ height: 56 }} />
      </>
    );
  }

  // 桌面端侧边栏（原有实现）
  return (
    <div
      style={{
        width: 240,
        height: "100%",
        backgroundColor: "#080808",
        borderRight: "1px solid #2f2f2f",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Logo */}
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
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>VIBE STUDIO</span>
      </div>

      {/* Nav */}
      <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                backgroundColor: isActive ? "rgba(0,255,136,0.08)" : "transparent",
                border: "none",
                borderLeft: isActive ? "2px solid #00ff88" : "2px solid transparent",
                color: isActive ? "#00ff88" : "#8a8a8a",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  backgroundImage: `url(${item.icon})`,
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  opacity: isActive ? 1 : 0.7,
                }}
              />
              {item.label}
            </button>
          );
        })}

        {/* Thread - dynamic to current project */}
        <button
          onClick={() => navigate(threadPath)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            backgroundColor:
              location.pathname.startsWith("/projects/") || location.pathname === "/thread"
                ? "rgba(0,255,136,0.08)"
                : "transparent",
            border: "none",
            borderLeft:
              location.pathname.startsWith("/projects/") || location.pathname === "/thread"
                ? "2px solid #00ff88"
                : "2px solid transparent",
            color:
              location.pathname.startsWith("/projects/") || location.pathname === "/thread"
                ? "#00ff88"
                : "#8a8a8a",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              backgroundImage: "url(/images/messagesquare.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              opacity:
                location.pathname.startsWith("/projects/") || location.pathname === "/thread"
                  ? 1
                  : 0.7,
            }}
          />
          Thread
          {projects.length > 0 && currentProjectId && (
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#6a6a6a" }}>
              {projects.find((p) => p.id === currentProjectId)?.name.slice(0, 8)}
            </span>
          )}
        </button>
      </div>

      {/* Footer with user info and logout */}
      <div
        style={{
          marginTop: "auto",
          padding: "16px 12px",
          borderTop: "1px solid #2f2f2f",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {FOOTER_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                backgroundColor: isActive ? "rgba(0,255,136,0.08)" : "transparent",
                border: "none",
                borderLeft: isActive ? "2px solid #00ff88" : "2px solid transparent",
                color: isActive ? "#00ff88" : "#8a8a8a",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  backgroundImage: `url(${item.icon})`,
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  opacity: isActive ? 1 : 0.7,
                }}
              />
              {item.label}
            </button>
          );
        })}

        {username && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 4px",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#00ff88",
              }}
            />
            <span style={{ fontSize: 11, color: "#8a8a8a" }}>{username}</span>
          </div>
        )}
        <button
          onClick={logout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            backgroundColor: "transparent",
            border: "1px solid #2f2f2f",
            color: "#8a8a8a",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 12 }}>↪</span>
          Logout
        </button>
      </div>
    </div>
  );
}
