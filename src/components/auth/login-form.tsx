"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function LoginForm() {
  const router = useRouter();
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
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>로그인</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>이메일</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일을 입력하세요" required autoFocus />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>비밀번호</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" required />
        </div>
        <Button type="submit" size="lg" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? "로그인 중..." : "로그인"}
        </Button>
      </form>
      <p className="text-center text-sm mt-4" style={{ color: "var(--text-secondary)" }}>
        계정이 없으신가요?{" "}
        <Link href="/signup" className="underline hover:no-underline" style={{ color: "var(--color-blue)" }}>회원가입</Link>
      </p>
    </div>
  );
}
