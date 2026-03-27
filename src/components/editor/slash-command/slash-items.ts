import type { Editor } from "@tiptap/react";

export type SlashItem = {
  title: string;
  description: string;
  icon: string;
  category: string;
  keywords: string[];
  command: (editor: Editor) => void;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: "텍스트",
    description: "일반 텍스트를 입력합니다.",
    icon: "Aa",
    category: "기본 블록",
    keywords: ["text", "paragraph", "텍스트"],
    command: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: "제목 1",
    description: "대제목",
    icon: "H1",
    category: "기본 블록",
    keywords: ["heading", "h1", "제목"],
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "제목 2",
    description: "중제목",
    icon: "H2",
    category: "기본 블록",
    keywords: ["heading", "h2", "제목"],
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "제목 3",
    description: "소제목",
    icon: "H3",
    category: "기본 블록",
    keywords: ["heading", "h3", "제목"],
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: "글머리 기호 목록",
    description: "글머리 기호로 간단한 목록을 만듭니다.",
    icon: "•",
    category: "기본 블록",
    keywords: ["bullet", "list", "불릿", "목록"],
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "번호 매기기 목록",
    description: "번호가 있는 목록을 만듭니다.",
    icon: "1.",
    category: "기본 블록",
    keywords: ["numbered", "list", "번호", "목록"],
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "할 일 목록",
    description: "할 일 목록으로 작업을 추적합니다.",
    icon: "☑",
    category: "기본 블록",
    keywords: ["todo", "task", "checkbox", "할일"],
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: "토글",
    description: "토글로 콘텐츠를 접거나 펼칩니다.",
    icon: "▶",
    category: "기본 블록",
    keywords: ["toggle", "토글", "접기"],
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "details",
          content: [
            {
              type: "detailsSummary",
              content: [{ type: "text", text: "토글" }],
            },
            {
              type: "detailsContent",
              content: [{ type: "paragraph" }],
            },
          ],
        })
        .run();
    },
  },
  {
    title: "콜아웃",
    description: "아이콘이 있는 강조 블록을 추가합니다.",
    icon: "💡",
    category: "기본 블록",
    keywords: ["callout", "콜아웃", "강조"],
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "callout",
          attrs: { icon: "💡", color: "default" },
        })
        .run();
    },
  },
  {
    title: "인용",
    description: "인용문을 표시합니다.",
    icon: "❝",
    category: "기본 블록",
    keywords: ["quote", "blockquote", "인용"],
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "구분선",
    description: "블록 사이에 구분선을 추가합니다.",
    icon: "—",
    category: "기본 블록",
    keywords: ["divider", "hr", "구분선"],
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: "코드",
    description: "코드 블록을 추가합니다.",
    icon: "<>",
    category: "고급 블록",
    keywords: ["code", "코드"],
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "수식",
    description: "수학 공식을 추가합니다.",
    icon: "∑",
    category: "고급 블록",
    keywords: ["equation", "math", "수식", "공식"],
    command: (editor) => {
      const expr = window.prompt("수식을 입력하세요 (LaTeX):");
      if (expr) {
        editor
          .chain()
          .focus()
          .insertContent({ type: "equation", attrs: { expression: expr } })
          .run();
      }
    },
  },
  {
    title: "목차",
    description: "페이지의 제목 목록을 표시합니다.",
    icon: "📑",
    category: "고급 블록",
    keywords: ["toc", "table of contents", "목차"],
    command: (editor) => {
      editor.chain().focus().insertContent({ type: "tableOfContents" }).run();
    },
  },
  {
    title: "2열",
    description: "2개의 열 레이아웃을 추가합니다.",
    icon: "⬜⬜",
    category: "고급 블록",
    keywords: ["column", "열", "레이아웃"],
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "columnList",
          content: [
            {
              type: "column",
              attrs: { width: 0.5 },
              content: [{ type: "paragraph" }],
            },
            {
              type: "column",
              attrs: { width: 0.5 },
              content: [{ type: "paragraph" }],
            },
          ],
        })
        .run();
    },
  },
  {
    title: "이미지",
    description: "이미지를 추가합니다.",
    icon: "🖼",
    category: "미디어",
    keywords: ["image", "이미지"],
    command: (editor) => {
      const url = window.prompt("이미지 URL:");
      if (url) editor.chain().focus().setImage({ src: url }).run();
    },
  },
  {
    title: "테이블",
    description: "테이블을 추가합니다.",
    icon: "▦",
    category: "고급 블록",
    keywords: ["table", "테이블"],
    command: (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "데이터베이스 - 인라인",
    description: "페이지 내에 인라인 데이터베이스를 추가합니다.",
    icon: "▦",
    category: "데이터베이스",
    keywords: ["database", "inline", "데이터베이스", "인라인", "DB"],
    command: (editor) => {
      editor.chain().focus().insertContent({
        type: "paragraph",
        content: [{ type: "text", text: "[인라인 데이터베이스 — 페이지에서 생성]" }],
      }).run();
    },
  },
  {
    title: "데이터베이스 - 풀페이지",
    description: "새로운 데이터베이스 페이지를 만듭니다.",
    icon: "📊",
    category: "데이터베이스",
    keywords: ["database", "full", "page", "데이터베이스", "풀페이지", "DB"],
    command: (editor) => {
      editor.chain().focus().insertContent({
        type: "paragraph",
        content: [{ type: "text", text: "[풀페이지 데이터베이스 — 사이드바에서 생성]" }],
      }).run();
    },
  },
];
