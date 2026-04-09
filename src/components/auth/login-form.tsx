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
  const [totpCode, setTotpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const getFriendlyErrorMessage = (message: string) => {
    switch (message) {
      case "Invalid email or password":
        return "이메일 또는 비밀번호가 올바르지 않습니다. 입력한 정보를 다시 확인해주세요.";
      case "2FA code required":
        return "이 계정은 2단계 인증이 켜져 있습니다. OTP 앱 코드 또는 백업 코드를 입력해주세요.";
      case "Invalid 2FA code":
        return "2단계 인증 코드가 올바르지 않습니다. 최신 코드를 다시 입력해주세요.";
      case "2FA configuration is unavailable":
        return "2단계 인증 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
      default:
        return message || "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
    }
  };

  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      setErrorMessage("");
      setStatusMessage("로그인에 성공했습니다. 워크스페이스로 이동하고 있어요.");
      addToast({
        type: "success",
        title: "로그인 완료",
        message: "워크스페이스를 불러오고 있습니다.",
        duration: 2500,
      });
      router.push("/");
      router.refresh();
    },
    onError: (error) => {
      const friendlyMessage = getFriendlyErrorMessage(error.message);
      if (error.message === "2FA code required") {
        setRequiresTwoFactor(true);
      }
      setErrorMessage(friendlyMessage);
      setStatusMessage("");
      addToast({
        type: error.message === "2FA code required" ? "warning" : "error",
        title: error.message === "2FA code required" ? "추가 인증 필요" : "로그인 실패",
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
    setStatusMessage(
      requiresTwoFactor || totpCode.trim().length > 0
        ? "2단계 인증 코드를 확인하고 있습니다."
        : "계정 정보를 확인하고 있습니다."
    );
    login.mutate({ email, password, totpCode: totpCode.trim() || undefined });
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h1
          className="text-[22px] font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {t("login")}
        </h1>
        <p
          className="mt-1 text-[13px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Yestion 계정으로 로그인하세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              setTotpCode("");
              setRequiresTwoFactor(false);
              setErrorMessage("");
              setStatusMessage("");
            }}
            placeholder={t("emailPlaceholder")}
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
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
            }}
          />
        </div>

        {(requiresTwoFactor || totpCode) && (
          <div>
            <label
              className="mb-1.5 block text-[13px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              2단계 인증 코드
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value);
                setErrorMessage("");
                setStatusMessage("");
              }}
              placeholder="6자리 코드 또는 백업 코드"
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
              OTP 앱에서 생성된 6자리 코드나 백업 코드를 입력해주세요.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#2383e2" }}
          onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = "#0b6ec5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#2383e2"; }}
        >
          {isLoading ? t("loggingIn") : t("login")}
        </button>

        {(errorMessage || statusMessage || requiresTwoFactor) && (
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
            {errorMessage || statusMessage || "추가 인증이 필요합니다."}
          </div>
        )}
      </form>

      <div className="mt-5 flex items-center justify-between">
        <Link
          href="/reset-password"
          className="text-[13px] transition-colors hover:underline"
          style={{ color: "var(--text-secondary)" }}
        >
          비밀번호 찾기
        </Link>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
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
