"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
      <div className="mb-6 text-center">
        <h1
          className="text-[22px] font-bold"
          style={{ color: "#37352f" }}
        >
          {t("login")}
        </h1>
        <p
          className="mt-1 text-[13px]"
          style={{ color: "#9b9a97" }}
        >
          Yestion 계정으로 로그인하세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "#37352f" }}
          >
            {t("email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            autoFocus
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20"
            style={{
              borderColor: "#e8e8e8",
              color: "#37352f",
              backgroundColor: "#ffffff",
            }}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "#37352f" }}
          >
            {t("password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            required
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20"
            style={{
              borderColor: "#e8e8e8",
              color: "#37352f",
              backgroundColor: "#ffffff",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#2383e2" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0b6ec5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2383e2")}
        >
          {isLoading ? t("loggingIn") : t("login")}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between">
        <Link
          href="/reset-password"
          className="text-[13px] transition-colors hover:underline"
          style={{ color: "#9b9a97" }}
        >
          비밀번호 찾기
        </Link>
        <p className="text-[13px]" style={{ color: "#9b9a97" }}>
          계정이 없으신가요?{" "}
          <Link
            href="/signup"
            className="font-medium transition-colors hover:underline"
            style={{ color: "#2383e2" }}
          >
            {t("signup")}
          </Link>
        </p>
      </div>
    </div>
  );
}
