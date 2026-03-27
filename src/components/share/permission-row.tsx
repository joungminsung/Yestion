"use client";

type PermissionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type PermissionRowProps = {
  id: string;
  user: PermissionUser;
  level: string;
  onUpdate: (id: string, level: "edit" | "comment" | "view") => void;
  onRemove: (id: string) => void;
};

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const levelLabels: Record<string, string> = {
  edit: "편집 가능",
  comment: "댓글 가능",
  view: "보기 가능",
};

export function PermissionRow({ id, user, level, onUpdate, onRemove }: PermissionRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className="flex items-center justify-center rounded-full text-white text-xs font-semibold flex-shrink-0"
        style={{ width: 28, height: 28, backgroundColor: "#9b59b6" }}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          getInitials(user.name)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{user.name}</div>
        <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{user.email}</div>
      </div>
      <select
        value={level}
        onChange={(e) => onUpdate(id, e.target.value as "edit" | "comment" | "view")}
        className="text-xs rounded px-2 py-1 border-none outline-none cursor-pointer"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-secondary)",
        }}
      >
        <option value="edit">{levelLabels.edit}</option>
        <option value="comment">{levelLabels.comment}</option>
        <option value="view">{levelLabels.view}</option>
      </select>
      <button
        onClick={() => onRemove(id)}
        className="p-1 rounded hover:bg-notion-bg-hover flex-shrink-0"
        style={{ color: "var(--text-secondary)" }}
        title="권한 삭제"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M3.5 3.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
