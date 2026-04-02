export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#ffffff" }}
    >
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <img
          src="/icon-192.png"
          alt="Yestion"
          width={48}
          height={48}
          className="mb-3"
        />
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: "#37352f" }}
        >
          Yestion
        </span>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-[400px] rounded-xl border p-8 shadow-sm"
        style={{
          backgroundColor: "#ffffff",
          borderColor: "#e8e8e8",
        }}
      >
        {children}
      </div>

      {/* Footer */}
      <p
        className="mt-6 text-xs"
        style={{ color: "#9b9a97" }}
      >
        &copy; {new Date().getFullYear()} Yestion. All rights reserved.
      </p>
    </div>
  );
}
