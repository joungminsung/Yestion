import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>페이지를 찾을 수 없습니다</h2>
      <p style={{ color: "#666", margin: "1rem 0" }}>
        요청하신 페이지가 존재하지 않습니다.
      </p>
      <Link
        href="/"
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "6px",
          border: "1px solid #ddd",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
