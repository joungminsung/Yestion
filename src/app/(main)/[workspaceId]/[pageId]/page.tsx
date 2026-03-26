// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PageView({ params }: { params: { workspaceId: string; pageId: string } }) {
  return (
    <div className="mx-auto py-12" style={{ maxWidth: "var(--page-max-width)", paddingLeft: "var(--page-padding-x)", paddingRight: "var(--page-padding-x)" }}>
      <h1 className="text-4xl font-bold outline-none" style={{ color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }} contentEditable suppressContentEditableWarning>
        제목 없음
      </h1>
      <div className="mt-4" style={{ color: "var(--text-placeholder)", fontSize: "16px", lineHeight: 1.5 }}>
        {`'/'를 입력하여 명령어 사용`}
      </div>
    </div>
  );
}
