"use client";

export default function OfflinePage() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">오프라인 상태입니다</h1>
        <p style={{ color: "var(--text-secondary)" }}>인터넷 연결을 확인한 후 다시 시도해주세요.</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 rounded" style={{ backgroundColor: "#2383e2", color: "white" }}>
          새로고침
        </button>
      </div>
    </div>
  );
}
