"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>문제가 발생했습니다</h2>
      <p style={{ color: "#666", margin: "1rem 0" }}>
        {error.message || "알 수 없는 오류가 발생했습니다."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "6px",
          border: "1px solid #ddd",
          cursor: "pointer",
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
