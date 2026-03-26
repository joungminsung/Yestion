export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list"
  | "numbered_list"
  | "to_do"
  | "toggle"
  | "quote"
  | "callout"
  | "code"
  | "equation"
  | "divider"
  | "table_of_contents"
  | "column_list"
  | "column"
  | "image"
  | "video"
  | "file"
  | "bookmark"
  | "embed"
  | "audio"
  | "table"
  | "synced_block"
  | "link_to_page";

export type Annotation = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  color: string;
};

export const DEFAULT_ANNOTATION: Annotation = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  color: "default",
};

export type RichTextSegment = {
  text: string;
  annotations: Annotation;
  link?: string;
  mention?: {
    type: "user" | "page" | "date";
    id: string;
  };
  equation?: string;
};

export type ParagraphContent = { richText: RichTextSegment[] };
export type HeadingContent = { richText: RichTextSegment[]; level: 1 | 2 | 3 };
export type TodoContent = { richText: RichTextSegment[]; checked: boolean };
export type ToggleContent = { richText: RichTextSegment[] };
export type CalloutContent = { richText: RichTextSegment[]; icon: string; color: string };
export type CodeContent = { code: string; language: string };
export type EquationContent = { expression: string };
export type ImageContent = { url: string; caption?: string; width?: number };
export type BookmarkContent = { url: string; title?: string; description?: string; image?: string };

export type BlockContent =
  | ParagraphContent
  | HeadingContent
  | TodoContent
  | ToggleContent
  | CalloutContent
  | CodeContent
  | EquationContent
  | ImageContent
  | BookmarkContent
  | Record<string, unknown>;

export type BlockData = {
  id: string;
  pageId: string;
  parentId: string | null;
  type: BlockType;
  content: BlockContent;
  position: number;
  children?: BlockData[];
};
