import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  Sparkles, Type, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, ChevronRight, Lightbulb,
  Quote, Minus, Code, Sigma, TableOfContents, Columns2,
  ImageIcon, Table, Link as LinkIcon, Play, MapPin,
  Bookmark, Film, Music, Paperclip, Database, BarChart3,
  RefreshCw, FileText, Calendar, Clock,
} from "lucide-react";

export type SlashItem = {
  title: string;
  description: string;
  icon: ReactNode;
  category: string;
  keywords: string[];
  command: (editor: Editor) => void;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: "AI에게 요청",
    description: "AI가 글을 작성하거나 편집합니다.",
    icon: <Sparkles size={18} />,
    category: "AI",
    keywords: ["ai", "gpt", "write", "인공지능"],
    command: (editor) => {
      // Insert a paragraph and dispatch event to trigger AI prompt overlay
      editor.chain().focus().insertContent({ type: "paragraph" }).run();
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      window.dispatchEvent(
        new CustomEvent("ai-open", {
          detail: { context: "", position: { top: coords.top + 24, left: coords.left } },
        })
      );
    },
  },
  {
    title: "텍스트",
    description: "일반 텍스트를 입력합니다.",
    icon: <Type size={18} />,
    category: "기본 블록",
    keywords: ["text", "paragraph", "텍스트"],
    command: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: "제목 1",
    description: "대제목",
    icon: <Heading1 size={18} />,
    category: "기본 블록",
    keywords: ["heading", "h1", "제목"],
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "제목 2",
    description: "중제목",
    icon: <Heading2 size={18} />,
    category: "기본 블록",
    keywords: ["heading", "h2", "제목"],
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "제목 3",
    description: "소제목",
    icon: <Heading3 size={18} />,
    category: "기본 블록",
    keywords: ["heading", "h3", "제목"],
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: "글머리 기호 목록",
    description: "글머리 기호로 간단한 목록을 만듭니다.",
    icon: <List size={18} />,
    category: "기본 블록",
    keywords: ["bullet", "list", "불릿", "목록"],
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "번호 매기기 목록",
    description: "번호가 있는 목록을 만듭니다.",
    icon: <ListOrdered size={18} />,
    category: "기본 블록",
    keywords: ["numbered", "list", "번호", "목록"],
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "할 일 목록",
    description: "할 일 목록으로 작업을 추적합니다.",
    icon: <ListChecks size={18} />,
    category: "기본 블록",
    keywords: ["todo", "task", "checkbox", "할일"],
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: "토글",
    description: "토글로 콘텐츠를 접거나 펼칩니다.",
    icon: <ChevronRight size={18} />,
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
    icon: <Lightbulb size={18} />,
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
    icon: <Quote size={18} />,
    category: "기본 블록",
    keywords: ["quote", "blockquote", "인용"],
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "구분선",
    description: "블록 사이에 구분선을 추가합니다.",
    icon: <Minus size={18} />,
    category: "기본 블록",
    keywords: ["divider", "hr", "구분선"],
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: "코드",
    description: "코드 블록을 추가합니다.",
    icon: <Code size={18} />,
    category: "고급 블록",
    keywords: ["code", "코드"],
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "수식",
    description: "수학 공식을 추가합니다. (라이브 미리보기)",
    icon: <Sigma size={18} />,
    category: "고급 블록",
    keywords: ["equation", "math", "수식", "공식", "latex", "katex"],
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({ type: "equation", attrs: { expression: "" } })
        .run();
    },
  },
  {
    title: "동기화 블록",
    description: "다른 페이지와 동기화되는 블록을 만듭니다.",
    icon: <RefreshCw size={18} />,
    category: "고급 블록",
    keywords: ["sync", "synced", "동기화", "미러"],
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({ type: "syncedBlock" })
        .run();
    },
  },
  {
    title: "페이지 링크",
    description: "다른 페이지로의 링크를 추가합니다.",
    icon: <FileText size={18} />,
    category: "고급 블록",
    keywords: ["link", "page", "페이지", "링크"],
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({ type: "linkToPage", attrs: { pageId: null, pageTitle: "", pageIcon: "📄" } })
        .run();
    },
  },
  {
    title: "하위 페이지",
    description: "현재 페이지 아래에 새 페이지를 만듭니다.",
    icon: <FileText size={18} />,
    category: "고급 블록",
    keywords: ["subpage", "page", "하위", "페이지", "새페이지"],
    command: (editor) => {
      editor.chain().focus().insertContent({
        type: "linkToPage",
        attrs: { pageId: "__new__", pageTitle: "", pageIcon: "📄" },
      }).run();
    },
  },
  {
    title: "목차",
    description: "페이지의 제목 목록을 표시합니다.",
    icon: <TableOfContents size={18} />,
    category: "고급 블록",
    keywords: ["toc", "table of contents", "목차"],
    command: (editor) => {
      editor.chain().focus().insertContent({ type: "tableOfContents" }).run();
    },
  },
  {
    title: "2열",
    description: "2개의 열 레이아웃을 추가합니다.",
    icon: <Columns2 size={18} />,
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
    title: "3열",
    description: "3개의 열 레이아웃을 추가합니다.",
    icon: <Columns2 size={18} />,
    category: "고급 블록",
    keywords: ["column", "3열", "레이아웃", "three"],
    command: (editor) => {
      editor.chain().focus().insertContent({
        type: "columnList",
        content: [
          { type: "column", attrs: { width: 0.33 }, content: [{ type: "paragraph" }] },
          { type: "column", attrs: { width: 0.34 }, content: [{ type: "paragraph" }] },
          { type: "column", attrs: { width: 0.33 }, content: [{ type: "paragraph" }] },
        ],
      }).run();
    },
  },
  {
    title: "4열",
    description: "4개의 열 레이아웃을 추가합니다.",
    icon: <Columns2 size={18} />,
    category: "고급 블록",
    keywords: ["column", "4열", "레이아웃", "four"],
    command: (editor) => {
      editor.chain().focus().insertContent({
        type: "columnList",
        content: Array.from({ length: 4 }, () => ({
          type: "column", attrs: { width: 0.25 }, content: [{ type: "paragraph" }],
        })),
      }).run();
    },
  },
  {
    title: "이미지",
    description: "이미지를 추가합니다.",
    icon: <ImageIcon size={18} />,
    category: "미디어",
    keywords: ["image", "이미지"],
    command: (editor) => {
      // Insert image with empty src to trigger the upload UI
      editor.chain().focus().setImage({ src: "" }).run();
    },
  },
  {
    title: "테이블",
    description: "테이블을 추가합니다.",
    icon: <Table size={18} />,
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
    title: "임베드",
    description: "외부 콘텐츠를 임베드합니다.",
    icon: <LinkIcon size={18} />,
    category: "미디어",
    keywords: ["embed", "임베드", "유튜브", "비메오"],
    command: (editor) => {
      editor.chain().focus().insertContent({ type: "embed", attrs: { url: "" } }).run();
    },
  },
  {
    title: "YouTube",
    description: "YouTube 동영상을 임베드합니다.",
    icon: <Play size={18} />,
    category: "미디어",
    keywords: ["youtube", "유튜브", "video", "동영상"],
    command: (editor) => {
      editor.chain().focus().insertContent({ type: "embed", attrs: { url: "", provider: "YouTube" } }).run();
    },
  },
  {
    title: "Google Maps",
    description: "Google 지도를 임베드합니다.",
    icon: <MapPin size={18} />,
    category: "미디어",
    keywords: ["google", "maps", "지도", "구글"],
    command: (editor) => {
      editor.chain().focus().insertContent({ type: "embed", attrs: { url: "", provider: "Google Maps" } }).run();
    },
  },
  {
    title: "북마크",
    description: "웹 링크를 미리보기 카드로 표시합니다.",
    icon: <Bookmark size={18} />,
    category: "미디어",
    keywords: ["bookmark", "북마크", "링크", "link"],
    command: (editor) => {
      editor.chain().focus().insertContent({ type: "bookmark", attrs: { url: "" } }).run();
    },
  },
  {
    title: "동영상",
    description: "동영상을 추가합니다.",
    icon: <Film size={18} />,
    category: "미디어",
    keywords: ["video", "동영상", "영상"],
    command: (editor) => editor.chain().focus().insertContent({ type: "videoBlock", attrs: { src: "" } }).run(),
  },
  {
    title: "오디오",
    description: "오디오를 추가합니다.",
    icon: <Music size={18} />,
    category: "미디어",
    keywords: ["audio", "오디오", "음악"],
    command: (editor) => editor.chain().focus().insertContent({ type: "audioBlock", attrs: { src: "" } }).run(),
  },
  {
    title: "파일",
    description: "파일을 첨부합니다.",
    icon: <Paperclip size={18} />,
    category: "미디어",
    keywords: ["file", "파일", "첨부"],
    command: (editor) => editor.chain().focus().insertContent({ type: "fileBlock", attrs: { src: "" } }).run(),
  },
  {
    title: "데이터베이스 - 인라인",
    description: "페이지 내에 인라인 데이터베이스를 추가합니다.",
    icon: <Database size={18} />,
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
    icon: <BarChart3 size={18} />,
    category: "데이터베이스",
    keywords: ["database", "full", "page", "데이터베이스", "풀페이지", "DB"],
    command: (editor) => {
      editor.chain().focus().insertContent({
        type: "paragraph",
        content: [{ type: "text", text: "[풀페이지 데이터베이스 — 사이드바에서 생성]" }],
      }).run();
    },
  },
  {
    title: "오늘 날짜",
    description: "오늘 날짜를 삽입합니다.",
    icon: <Calendar size={18} />,
    category: "인라인",
    keywords: ["today", "date", "오늘", "날짜"],
    command: (editor) => {
      const today = new Date().toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
      });
      editor.chain().focus().insertContent(today).run();
    },
  },
  {
    title: "내일 날짜",
    description: "내일 날짜를 삽입합니다.",
    icon: <Calendar size={18} />,
    category: "인라인",
    keywords: ["tomorrow", "내일", "날짜"],
    command: (editor) => {
      const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
      });
      editor.chain().focus().insertContent(tomorrow).run();
    },
  },
  {
    title: "현재 시간",
    description: "현재 날짜와 시간을 삽입합니다.",
    icon: <Clock size={18} />,
    category: "인라인",
    keywords: ["now", "time", "현재", "시간"],
    command: (editor) => {
      const now = new Date().toLocaleString("ko-KR", {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
        hour: "2-digit", minute: "2-digit",
      });
      editor.chain().focus().insertContent(now).run();
    },
  },
];
