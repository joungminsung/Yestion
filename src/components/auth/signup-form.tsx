"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function SignupForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const addToast = useToastStore((s) => s.addToast);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const signup = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
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
    signup.mutate({ email, name, password });
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{t("signup")}</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("name")}</label>
          <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} required autoFocus />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("email")}</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} required />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{t("password")}</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} required minLength={8} />
        </div>
        <Button type="submit" size="lg" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? t("signingUp") : t("signup")}
        </Button>
      </form>
      <p className="text-center text-sm mt-4" style={{ color: "var(--text-secondary)" }}>
        {t("hasAccount")}{" "}
        <Link href="/login" className="underline hover:no-underline" style={{ color: "var(--color-blue)" }}>{t("login")}</Link>
      </p>
    </div>
  );
}
