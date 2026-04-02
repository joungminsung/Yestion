"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
      <div className="mb-6 text-center">
        <h1
          className="text-[22px] font-bold"
          style={{ color: "#37352f" }}
        >
          {t("signup")}
        </h1>
        <p
          className="mt-1 text-[13px]"
          style={{ color: "#9b9a97" }}
        >
          Yestion을 시작하세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "#37352f" }}
          >
            {t("name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
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
            {t("email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
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
            minLength={8}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20"
            style={{
              borderColor: "#e8e8e8",
              color: "#37352f",
              backgroundColor: "#ffffff",
            }}
          />
          <p
            className="mt-1 text-[11px]"
            style={{ color: "#b4b4b0" }}
          >
            8자 이상 입력해주세요
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#2383e2" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0b6ec5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2383e2")}
        >
          {isLoading ? t("signingUp") : t("signup")}
        </button>
      </form>

      <p
        className="mt-5 text-center text-[13px]"
        style={{ color: "#9b9a97" }}
      >
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="font-medium transition-colors hover:underline"
          style={{ color: "#2383e2" }}
        >
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
