"use client";

import { useState, useEffect } from "react";

export function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-opacity"
      style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", zIndex: 50 }}
    >
      ↑
    </button>
  );
}
