"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const addToast = useToastStore((s) => s.addToast);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Set cookie client-side to ensure it's always applied
      document.cookie = `session-token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
      router.push("/");
      router.refresh();
    },
    onError: (error) => {
      addToast({ message: error.message, type: "error" });
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    login.mutate({ email, password });
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{t("login")}</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("email")}</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} required autoFocus />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("password")}</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} required />
        </div>
        <Button type="submit" size="lg" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? t("loggingIn") : t("login")}
        </Button>
      </form>
      <div className="flex items-center justify-between mt-4">
        <Link href="/reset-password" className="text-sm underline hover:no-underline" style={{ color: "var(--text-secondary)" }}>
          비밀번호 찾기
        </Link>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("noAccount")}{" "}
          <Link href="/signup" className="underline hover:no-underline" style={{ color: "var(--color-blue)" }}>{t("signup")}</Link>
        </p>
      </div>
    </div>
  );
}
