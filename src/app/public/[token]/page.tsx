import { db } from "@/server/db/client";
import { notFound } from "next/navigation";

export default async function PublicPage({ params }: { params: { token: string } }) {
  const page = await db.page.findUnique({
    where: { publicAccessToken: params.token },
    include: {
      blocks: {
        where: { parentId: null },
        orderBy: { position: "asc" },
        include: { children: { orderBy: { position: "asc" } } },
      },
    },
  });

  if (!page || page.isDeleted) return notFound();

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Minimal topbar */}
      <header
        className="sticky top-0 flex items-center px-4 border-b"
        style={{
          height: "45px",
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-default)",
          zIndex: 10,
        }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {page.icon && <span className="mr-2">{page.icon}</span>}
          {page.title || "제목 없음"}
        </span>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded"
          style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
        >
          {page.publicAccessLevel === "edit" ? "편집 가능" : page.publicAccessLevel === "comment" ? "댓글 가능" : "보기 전용"}
        </span>
      </header>

      {/* Page content */}
      <main
        className="mx-auto py-8"
        style={{
          maxWidth: "var(--page-max-width, 720px)",
          paddingLeft: "var(--page-padding-x, 96px)",
          paddingRight: "var(--page-padding-x, 96px)",
        }}
      >
        {/* Cover */}
        {page.cover && (
          <div className="mb-6 -mx-24 rounded-sm overflow-hidden" style={{ height: "200px" }}>
            <img src={page.cover} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Icon + Title */}
        <div className="mb-6">
          {page.icon && <div className="text-5xl mb-3">{page.icon}</div>}
          <h1
            className="text-4xl font-bold"
            style={{ color: "var(--text-primary)", fontFamily: "var(--notion-font-family)" }}
          >
            {page.title || "제목 없음"}
          </h1>
        </div>

        {/* Blocks */}
        <div className="space-y-1">
          {page.blocks.map((block) => (
            <PublicBlock key={block.id} block={block} />
          ))}
        </div>
      </main>
    </div>
  );
}

type BlockData = {
  id: string;
  type: string;
  content: any;
  children?: BlockData[];
};

function PublicBlock({ block }: { block: BlockData }) {
  const content = block.content as any;
  const text = content?.richText?.map((rt: any) => rt.text || rt.content || "").join("") || content?.text || "";

  const renderText = () => {
    switch (block.type) {
      case "heading_1":
        return <h2 className="text-2xl font-bold mt-6 mb-1" style={{ color: "var(--text-primary)" }}>{text}</h2>;
      case "heading_2":
        return <h3 className="text-xl font-semibold mt-4 mb-1" style={{ color: "var(--text-primary)" }}>{text}</h3>;
      case "heading_3":
        return <h4 className="text-lg font-medium mt-3 mb-1" style={{ color: "var(--text-primary)" }}>{text}</h4>;
      case "bulleted_list":
        return (
          <div className="flex gap-2">
            <span style={{ color: "var(--text-secondary)" }}>&#8226;</span>
            <span style={{ color: "var(--text-primary)" }}>{text}</span>
          </div>
        );
      case "numbered_list":
        return (
          <div className="flex gap-2">
            <span style={{ color: "var(--text-secondary)" }}>{content?.number || "1"}.</span>
            <span style={{ color: "var(--text-primary)" }}>{text}</span>
          </div>
        );
      case "to_do":
        return (
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!content?.checked} readOnly className="pointer-events-none" />
            <span style={{ color: "var(--text-primary)", textDecoration: content?.checked ? "line-through" : "none" }}>{text}</span>
          </div>
        );
      case "toggle":
        return (
          <details>
            <summary className="cursor-pointer" style={{ color: "var(--text-primary)" }}>{text}</summary>
            {block.children?.map((child) => (
              <div key={child.id} className="pl-6">
                <PublicBlock block={child} />
              </div>
            ))}
          </details>
        );
      case "code":
        return (
          <pre
            className="rounded p-3 text-sm overflow-x-auto my-2"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            <code>{text}</code>
          </pre>
        );
      case "quote":
        return (
          <blockquote
            className="border-l-2 pl-4 my-2"
            style={{ borderColor: "var(--text-secondary)", color: "var(--text-primary)" }}
          >
            {text}
          </blockquote>
        );
      case "divider":
        return <hr className="my-4" style={{ borderColor: "var(--border-default)" }} />;
      case "image":
        return content?.url ? (
          <div className="my-3">
            <img src={content.url} alt={content.caption || ""} className="max-w-full rounded" />
            {content.caption && (
              <p className="text-xs mt-1 text-center" style={{ color: "var(--text-secondary)" }}>{content.caption}</p>
            )}
          </div>
        ) : null;
      default:
        return <p className="min-h-[1.5em]" style={{ color: "var(--text-primary)" }}>{text || "\u00A0"}</p>;
    }
  };

  return (
    <div>
      {renderText()}
      {block.type !== "toggle" && block.children?.map((child) => (
        <div key={child.id} className="pl-6">
          <PublicBlock block={child} />
        </div>
      ))}
    </div>
  );
}
