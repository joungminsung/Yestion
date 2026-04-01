"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const addToast = useToastStore((s) => s.addToast);

  // If no token, show request form
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
        <h1 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>이메일을 확인하세요</h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          비밀번호 재설정 링크를 {email}로 보냈습니다.
        </p>
        <Link href="/login" className="text-sm underline" style={{ color: "var(--color-blue)" }}>
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>비밀번호 재설정</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>가입한 이메일을 입력하세요</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); requestReset.mutate({ email }); }} className="flex flex-col gap-3">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" required autoFocus />
        <Button type="submit" size="lg" className="w-full mt-2" disabled={requestReset.isPending}>
          {requestReset.isPending ? "전송 중..." : "재설정 링크 보내기"}
        </Button>
      </form>
      <p className="text-center text-sm mt-4" style={{ color: "var(--text-secondary)" }}>
        <Link href="/login" className="underline" style={{ color: "var(--color-blue)" }}>로그인으로 돌아가기</Link>
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
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>새 비밀번호 설정</h1>
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (password !== confirm) { addToast({ message: "비밀번호가 일치하지 않습니다", type: "error" }); return; }
        resetPassword.mutate({ token, newPassword: password });
      }} className="flex flex-col gap-3">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="새 비밀번호 (8자 이상)" required minLength={8} autoFocus />
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="비밀번호 확인" required minLength={8} />
        <Button type="submit" size="lg" className="w-full mt-2" disabled={resetPassword.isPending}>
          {resetPassword.isPending ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </form>
    </div>
  );
}
