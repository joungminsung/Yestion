"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { FileText, LayoutTemplate, Plus, Search } from "lucide-react";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { TemplateGallery } from "@/components/page/template-gallery";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function WorkspaceHome() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const openPalette = useCommandPaletteStore((s) => s.open);

  const { data: pages, isLoading } = trpc.page.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  // page.list already filters isDeleted:false server-side and orders by position
  const recentPages = pages?.slice(0, 8);
  const totalPages = pages?.length ?? 0;

  const createPage = trpc.page.create.useMutation({
    onSuccess: (newPage) => {
      router.push(`/${workspaceId}/${newPage.id}`);
    },
  });

  const [showGallery, setShowGallery] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="h-8 w-48 rounded bg-notion-bg-hover animate-pulse mb-8" />
        <div className="flex gap-3 mb-8">
          <div className="h-10 w-28 rounded-lg bg-notion-bg-hover animate-pulse" />
          <div className="h-10 w-28 rounded-lg bg-notion-bg-hover animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-10 rounded-lg bg-notion-bg-hover animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Greeting */}
      <h1
        className="text-2xl font-semibold mb-8"
        style={{ color: "var(--text-primary)" }}
      >
        {getGreeting()} 👋
      </h1>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => createPage.mutate({ workspaceId, title: "" })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-notion-bg-hover transition-colors"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        >
          <Plus size={16} />
          <span className="text-sm">New Page</span>
        </button>
        <button
          onClick={openPalette}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-notion-bg-hover transition-colors"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        >
          <Search size={16} />
          <span className="text-sm">Search</span>
        </button>
        <button
          onClick={() => setShowGallery(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-notion-bg-hover transition-colors"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        >
          <LayoutTemplate size={16} />
          <span className="text-sm">Templates</span>
        </button>
      </div>

      {/* Recent Pages */}
      <section className="mb-8">
        <h2
          className="text-sm font-medium mb-3 flex items-center gap-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          Pages
        </h2>
        <div className="space-y-0.5">
          {recentPages?.map((page) => (
            <button
              key={page.id}
              onClick={() => router.push(`/${workspaceId}/${page.id}`)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-notion-bg-hover transition-colors text-left"
            >
              <span className="text-base shrink-0">
                {page.icon ? (
                  page.icon
                ) : (
                  <FileText size={16} style={{ color: "var(--text-tertiary)" }} />
                )}
              </span>
              <span
                className="flex-1 text-sm truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {page.title || "Untitled"}
              </span>
            </button>
          ))}
          {(!recentPages || recentPages.length === 0) && (
            <p className="text-sm px-3 py-4" style={{ color: "var(--text-tertiary)" }}>
              No pages yet. Create your first page to get started.
            </p>
          )}
        </div>
      </section>

      {/* Stats */}
      <section>
        <div
          className="flex gap-6 px-4 py-3 rounded-lg border"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2">
            <FileText size={14} style={{ color: "var(--text-tertiary)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              {totalPages} Pages
            </span>
          </div>
        </div>
      </section>

      {showGallery && (
        <TemplateGallery
          workspaceId={workspaceId}
          onSelect={(tmpl) => {
            createPage.mutate({ workspaceId, title: tmpl.name });
            setShowGallery(false);
          }}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
}
