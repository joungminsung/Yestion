"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, CloudOff } from "lucide-react";
import { syncQueue } from "@/lib/offline/sync-queue";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingOps, setPendingOps] = useState(0);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Show briefly then hide
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check queue size periodically
    const interval = setInterval(async () => {
      const size = await syncQueue.size();
      setPendingOps(size);
    }, 5000);

    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm transition-all duration-300"
      style={{
        backgroundColor: isOnline ? "#27ae6020" : "#e74c3c20",
        color: isOnline ? "#27ae60" : "#e74c3c",
      }}
    >
      {isOnline ? (
        <>
          <Wifi size={14} />
          <span>온라인으로 복원되었습니다.</span>
          {pendingOps > 0 && <span>({pendingOps}개 변경사항 동기화 중...)</span>}
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>오프라인 상태입니다. 변경사항은 로컬에 저장됩니다.</span>
          {pendingOps > 0 && (
            <span className="flex items-center gap-1">
              <CloudOff size={12} /> {pendingOps}개 대기 중
            </span>
          )}
        </>
      )}
    </div>
  );
}
