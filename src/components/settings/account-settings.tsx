"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { useThemeStore } from "@/stores/theme";
import { cn } from "@/lib/utils";

export function AccountSettings() {
  const addToast = useToastStore((s) => s.addToast);
  const { theme, setTheme } = useThemeStore();
  const { data: user, refetch } = trpc.user.me.useQuery();
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("ko");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setLocale(user.locale);
    }
  }, [user]);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => { addToast({ message: "프로필이 업데이트되었습니다", type: "success" }); refetch(); },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  if (!user) return null;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--text-primary)" }}>내 계정</h2>

      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>프로필</h3>
        <div className="flex flex-col gap-3 max-w-[400px]">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>이메일</label>
            <Input value={user.email} disabled />
          </div>
          <Button onClick={() => updateProfile.mutate({ name })} size="md" className="self-start">저장</Button>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>테마</h3>
        <div className="flex gap-2">
          {(["system", "light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTheme(t); updateProfile.mutate({ theme: t }); }}
              className={cn("px-4 py-2 rounded text-sm border", theme === t ? "border-[#2383e2] font-medium" : "border-transparent hover:bg-notion-bg-hover")}
              style={{ color: theme === t ? "var(--color-blue)" : "var(--text-secondary)", backgroundColor: theme === t ? "var(--color-blue-bg)" : undefined }}
            >
              {t === "system" ? "시스템" : t === "light" ? "라이트" : "다크"}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>언어</h3>
        <div className="flex gap-2">
          {([{ id: "ko" as const, label: "한국어" }, { id: "en" as const, label: "English" }]).map((l) => (
            <button
              key={l.id}
              onClick={() => { setLocale(l.id); updateProfile.mutate({ locale: l.id }); }}
              className={cn("px-4 py-2 rounded text-sm border", locale === l.id ? "border-[#2383e2] font-medium" : "border-transparent hover:bg-notion-bg-hover")}
              style={{ color: locale === l.id ? "var(--color-blue)" : "var(--text-secondary)", backgroundColor: locale === l.id ? "var(--color-blue-bg)" : undefined }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
