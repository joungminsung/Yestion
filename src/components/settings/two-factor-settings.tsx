"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function TwoFactorSettings() {
  const addToast = useToastStore((s) => s.addToast);
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "backup" | "disable">("idle");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");

  const { data: user, refetch: refetchUser } = trpc.user.me.useQuery();

  const setup2FA = trpc.auth.setup2FA.useMutation({
    onSuccess: (data) => {
      setQrCode(data.qrCodeUrl);
      setSecret(data.secret);
      setStep("verify");
    },
    onError: (err) => {
      addToast({ message: err.message || "2FA 설정에 실패했습니다", type: "error" });
    },
  });

  const verify2FA = trpc.auth.verify2FA.useMutation({
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setStep("backup");
      refetchUser();
      addToast({ message: "2단계 인증이 활성화되었습니다", type: "success" });
    },
    onError: (err) => {
      addToast({ message: err.message || "인증 코드가 올바르지 않습니다", type: "error" });
    },
  });

  const disable2FA = trpc.auth.disable2FA.useMutation({
    onSuccess: () => {
      setStep("idle");
      setDisablePassword("");
      refetchUser();
      addToast({ message: "2단계 인증이 비활성화되었습니다", type: "success" });
    },
    onError: (err) => {
      addToast({ message: err.message || "비밀번호가 올바르지 않습니다", type: "error" });
    },
  });

  // Check if 2FA is enabled from user data
  // We use a "totpEnabled" field stored as part of the user profile
  // Since the schema may not have this, we check via user query
  const is2FAEnabled = (user as Record<string, unknown> | undefined)?.totpEnabled === true;

  const handleStartSetup = () => {
    setStep("setup");
    setup2FA.mutate();
  };

  const handleVerify = () => {
    if (verifyCode.length !== 6) {
      addToast({ message: "6자리 인증 코드를 입력해주세요", type: "error" });
      return;
    }
    verify2FA.mutate({ token: verifyCode, secret });
  };

  const handleDisable = () => {
    if (!disablePassword) {
      addToast({ message: "비밀번호를 입력해주세요", type: "error" });
      return;
    }
    disable2FA.mutate({ password: disablePassword });
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    addToast({ message: "백업 코드가 복사되었습니다", type: "success" });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        2단계 인증 (2FA)
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        인증 앱(Google Authenticator, Authy 등)을 사용하여 계정에 추가 보안을 설정합니다.
      </p>

      {/* Idle state - show enable/disable */}
      {step === "idle" && (
        <div>
          <div
            className="flex items-center justify-between p-4 rounded-lg mb-4"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                2단계 인증
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                {is2FAEnabled ? "활성화됨" : "비활성화됨"}
              </p>
            </div>
            <div
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: is2FAEnabled ? "rgba(38,203,124,0.1)" : "rgba(235,87,87,0.1)",
                color: is2FAEnabled ? "#26cb7c" : "#eb5757",
              }}
            >
              {is2FAEnabled ? "ON" : "OFF"}
            </div>
          </div>

          {!is2FAEnabled ? (
            <Button onClick={handleStartSetup} size="md">
              🔐 2단계 인증 설정
            </Button>
          ) : (
            <Button
              onClick={() => setStep("disable")}
              size="md"
              variant="ghost"
              className="!text-[#eb5757]"
            >
              2단계 인증 해제
            </Button>
          )}
        </div>
      )}

      {/* Setup - loading */}
      {step === "setup" && (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            QR 코드를 생성하는 중...
          </p>
        </div>
      )}

      {/* Verify - show QR and input */}
      {step === "verify" && (
        <div className="max-w-[400px]">
          <div className="mb-4">
            <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
              1. 인증 앱에서 QR 코드를 스캔하세요
            </p>
            <div
              className="flex justify-center p-4 rounded-lg mb-2"
              style={{ backgroundColor: "white", border: "1px solid var(--border-default)" }}
            >
              {qrCode && (
                <img src={qrCode} alt="2FA QR Code" width={200} height={200} />
              )}
            </div>
            <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>
              QR 코드를 스캔할 수 없나요? 수동 입력 키:
            </p>
            <div
              className="text-center mt-1 px-3 py-2 rounded font-mono text-xs select-all"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                wordBreak: "break-all",
              }}
            >
              {secret}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
              2. 인증 앱에 표시된 6자리 코드를 입력하세요
            </p>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-lg font-mono tracking-widest"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={verify2FA.isPending || verifyCode.length !== 6}
              size="md"
            >
              {verify2FA.isPending ? "확인 중..." : "인증 확인"}
            </Button>
            <Button
              onClick={() => {
                setStep("idle");
                setVerifyCode("");
              }}
              size="md"
              variant="ghost"
            >
              취소
            </Button>
          </div>
        </div>
      )}

      {/* Backup codes */}
      {step === "backup" && (
        <div className="max-w-[400px]">
          <div
            className="p-4 rounded-lg mb-4"
            style={{ backgroundColor: "rgba(235,87,87,0.05)", border: "1px solid rgba(235,87,87,0.2)" }}
          >
            <p className="text-sm font-medium mb-1" style={{ color: "#eb5757" }}>
              백업 코드를 안전한 곳에 저장하세요!
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              인증 앱에 접근할 수 없을 때 이 코드를 사용하여 로그인할 수 있습니다. 각 코드는 한 번만 사용할 수 있습니다.
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-2 p-4 rounded-lg mb-4 font-mono text-sm"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {backupCodes.map((code, i) => (
              <div key={i} className="text-center py-1" style={{ color: "var(--text-primary)" }}>
                {code}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={copyBackupCodes} size="md" variant="ghost">
              📋 코드 복사
            </Button>
            <Button
              onClick={() => {
                setStep("idle");
                setBackupCodes([]);
                setVerifyCode("");
              }}
              size="md"
            >
              완료
            </Button>
          </div>
        </div>
      )}

      {/* Disable 2FA */}
      {step === "disable" && (
        <div className="max-w-[400px]">
          <p className="text-sm mb-3" style={{ color: "var(--text-primary)" }}>
            2단계 인증을 해제하려면 현재 비밀번호를 입력하세요.
          </p>
          <div className="mb-4">
            <Input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="비밀번호"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDisable}
              disabled={disable2FA.isPending || !disablePassword}
              size="md"
              className="!bg-[#eb5757] !text-white hover:!opacity-90"
            >
              {disable2FA.isPending ? "처리 중..." : "2FA 해제"}
            </Button>
            <Button
              onClick={() => {
                setStep("idle");
                setDisablePassword("");
              }}
              size="md"
              variant="ghost"
            >
              취소
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
