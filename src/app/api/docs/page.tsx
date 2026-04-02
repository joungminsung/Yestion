"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import { useEffect, useState } from "react";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/docs/spec")
      .then((res) => res.json())
      .then(setSpec);
  }, []);

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ color: "var(--text-secondary)" }}>
        API documentation loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#ffffff" }}>
      <SwaggerUI spec={spec} />
    </div>
  );
}
