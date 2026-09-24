import Link from "next/link";

export function ActiDeskCta({
  size = "default",
  className = "",
}: {
  size?: "default" | "compact";
  className?: string;
}) {
  const sizeClasses = size === "compact" ? "px-5 py-2 text-xs" : "px-8 py-3 text-sm";
  return (
    <Link
      href="/signup"
      className={`btn-angled inline-block bg-electric font-mono-brand font-medium uppercase tracking-wider text-ink hover:bg-electric/90 ${sizeClasses} ${className}`}
    >
      Get Started →
    </Link>
  );
}
