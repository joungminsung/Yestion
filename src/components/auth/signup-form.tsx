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
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const getFriendlyErrorMessage = (message: string) => {
    switch (message) {
      case "Email already exists":
        return "이미 가입된 이메일입니다. 로그인하거나 비밀번호 재설정을 이용해주세요.";
      default:
        return message || "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.";
    }
  };

  const signup = trpc.auth.signup.useMutation({
    onSuccess: () => {
      setErrorMessage("");
      setStatusMessage("계정을 만들었습니다. 첫 워크스페이스로 이동하고 있어요.");
      addToast({
        type: "success",
        title: "회원가입 완료",
        message: "워크스페이스와 시작 페이지를 준비하고 있습니다.",
        duration: 2500,
      });
      router.push("/");
      router.refresh();
    },
    onError: (error) => {
      const friendlyMessage = getFriendlyErrorMessage(error.message);
      setErrorMessage(friendlyMessage);
      setStatusMessage("");
      addToast({
        type: "error",
        title: "회원가입 실패",
        message: friendlyMessage,
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);
    setStatusMessage("계정과 기본 워크스페이스를 만들고 있습니다.");
    signup.mutate({ email, name, password });
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h1
          className="text-[22px] font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {t("signup")}
        </h1>
        <p
          className="mt-1 text-[13px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Yestion을 시작하세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {t("name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrorMessage("");
              setStatusMessage("");
            }}
            placeholder={t("namePlaceholder")}
            required
            autoFocus
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
            }}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {t("email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrorMessage("");
              setStatusMessage("");
            }}
            placeholder={t("emailPlaceholder")}
            required
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
            }}
          />
        </div>

        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {t("password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorMessage("");
              setStatusMessage("");
            }}
            placeholder={t("passwordPlaceholder")}
            required
            minLength={8}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
            }}
          />
          <p
            className="mt-1 text-[11px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            8자 이상 입력해주세요
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#2383e2" }}
          onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = "#0b6ec5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#2383e2"; }}
        >
          {isLoading ? t("signingUp") : t("signup")}
        </button>

        {(errorMessage || statusMessage) && (
          <div
            className="rounded-lg border px-3 py-2.5 text-[12px] leading-5"
            style={{
              borderColor: errorMessage
                ? "rgba(224, 62, 62, 0.2)"
                : "rgba(35, 131, 226, 0.18)",
              backgroundColor: errorMessage
                ? "rgba(224, 62, 62, 0.05)"
                : "rgba(35, 131, 226, 0.05)",
              color: errorMessage ? "#b42318" : "var(--text-secondary)",
            }}
          >
            {errorMessage || statusMessage}
          </div>
        )}
      </form>

      <p
        className="mt-5 text-center text-[13px]"
        style={{ color: "var(--text-secondary)" }}
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
