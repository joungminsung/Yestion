"use client";
import { useEffect, useState, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

type Heading = { level: number; text: string; pos: number };

export function TocNodeView({ editor }: NodeViewProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  const extractHeadings = useCallback(() => {
    const items: Heading[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        items.push({
          level: node.attrs.level as number,
          text: node.textContent,
          pos,
        });
      }
    });
    setHeadings(items);
  }, [editor]);

  useEffect(() => {
    extractHeadings();
    editor.on("update", extractHeadings);
    return () => { editor.off("update", extractHeadings); };
  }, [editor, extractHeadings]);

  const scrollToHeading = (pos: number) => {
    editor.chain().focus().setTextSelection(pos + 1).run();
    const dom = editor.view.domAtPos(pos + 1);
    if (dom.node instanceof HTMLElement) {
      dom.node.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (dom.node.parentElement) {
      dom.node.parentElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <NodeViewWrapper>
      <div
        className="notion-toc my-3 py-2 px-3 rounded"
        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
        contentEditable={false}
      >
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>
          목차
        </div>
        {headings.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            제목을 추가하면 자동으로 목차가 생성됩니다
          </p>
        ) : (
          <ul className="space-y-0.5">
            {headings.map((h, i) => (
              <li key={`${h.pos}-${i}`} style={{ paddingLeft: `${(h.level - 1) * 16}px` }}>
                <button
                  onClick={() => scrollToHeading(h.pos)}
                  className="text-sm hover:underline text-left w-full truncate py-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {h.text || "제목 없음"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </NodeViewWrapper>
  );
}
