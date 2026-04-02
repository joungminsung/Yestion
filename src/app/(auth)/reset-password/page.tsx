"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (!token) return <RequestResetForm />;
  return <SetNewPasswordForm token={token} />;
}

function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  if (sent) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "#2383e210" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2383e2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h1
          className="text-[22px] font-bold mb-2"
          style={{ color: "#37352f" }}
        >
          이메일을 확인하세요
        </h1>
        <p
          className="text-[13px] mb-5"
          style={{ color: "#9b9a97" }}
        >
          비밀번호 재설정 링크를<br />
          <strong style={{ color: "#37352f" }}>{email}</strong>으로 보냈습니다.
        </p>
        <Link
          href="/login"
          className="text-[13px] font-medium transition-colors hover:underline"
          style={{ color: "#2383e2" }}
        >
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1
          className="text-[22px] font-bold"
          style={{ color: "#37352f" }}
        >
          비밀번호 재설정
        </h1>
        <p
          className="mt-1 text-[13px]"
          style={{ color: "#9b9a97" }}
        >
          가입한 이메일을 입력하세요
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); requestReset.mutate({ email }); }}
        className="flex flex-col gap-4"
      >
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "#37352f" }}
          >
            이메일
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
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

        <button
          type="submit"
          disabled={requestReset.isPending}
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#2383e2" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0b6ec5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2383e2")}
        >
          {requestReset.isPending ? "전송 중..." : "재설정 링크 보내기"}
        </button>
      </form>

      <p
        className="mt-5 text-center text-[13px]"
        style={{ color: "#9b9a97" }}
      >
        <Link
          href="/login"
          className="font-medium transition-colors hover:underline"
          style={{ color: "#2383e2" }}
        >
          로그인으로 돌아가기
        </Link>
      </p>
    </div>
  );
}

function SetNewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      addToast({ message: "비밀번호가 변경되었습니다", type: "success" });
      router.push("/login");
    },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  return (
    <div>
      <div className="mb-6 text-center">
        <h1
          className="text-[22px] font-bold"
          style={{ color: "#37352f" }}
        >
          새 비밀번호 설정
        </h1>
        <p
          className="mt-1 text-[13px]"
          style={{ color: "#9b9a97" }}
        >
          새로운 비밀번호를 입력해주세요
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (password !== confirm) {
            addToast({ message: "비밀번호가 일치하지 않습니다", type: "error" });
            return;
          }
          resetPassword.mutate({ token, newPassword: password });
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: "#37352f" }}
          >
            새 비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            required
            minLength={8}
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
            비밀번호 확인
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="비밀번호를 다시 입력"
            required
            minLength={8}
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
          disabled={resetPassword.isPending}
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#2383e2" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0b6ec5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2383e2")}
        >
          {resetPassword.isPending ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}
