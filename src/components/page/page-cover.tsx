"use client";

import { useState } from "react";

type PageCoverProps = {
  cover: string;
  onChangeCover: () => void;
  onRemoveCover: () => void;
};

export function PageCover({ cover, onChangeCover, onRemoveCover }: PageCoverProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative w-full"
      style={{ height: "30vh", minHeight: "180px", maxHeight: "280px" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={cover}
        alt="Page cover"
        className="w-full h-full object-cover"
        style={{ display: "block" }}
      />
      {isHovered && (
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <button
            onClick={onChangeCover}
            className="px-3 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-secondary)",
              boxShadow: "var(--shadow-tooltip)",
              opacity: 0.9,
            }}
          >
            커버 변경
          </button>
          <button
            onClick={onRemoveCover}
            className="px-3 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-secondary)",
              boxShadow: "var(--shadow-tooltip)",
              opacity: 0.9,
            }}
          >
            제거
          </button>
        </div>
      )}
    </div>
  );
}
