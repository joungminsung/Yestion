"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function SignupForm() {
  const router = useRouter();
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
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>회원가입</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>이름</label>
          <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" required autoFocus />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>이메일</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일을 입력하세요" required />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>비밀번호</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요 (8자 이상)" required minLength={8} />
        </div>
        <Button type="submit" size="lg" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? "가입 중..." : "회원가입"}
        </Button>
      </form>
      <p className="text-center text-sm mt-4" style={{ color: "var(--text-secondary)" }}>
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="underline hover:no-underline" style={{ color: "var(--color-blue)" }}>로그인</Link>
      </p>
    </div>
  );
}
