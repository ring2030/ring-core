import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";
export type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

function joinClasses(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

const badgeToneClass: Record<BadgeTone, string> = {
  neutral: "border-stone-200 bg-stone-100 text-stone-600",
  info: "border-sky-200 bg-sky-100 text-sky-700",
  success: "border-emerald-200 bg-emerald-100 text-emerald-700",
  warning: "border-amber-200 bg-amber-100 text-amber-700",
  danger: "border-red-200 bg-red-100 text-red-700",
  accent: "border-violet-200 bg-violet-100 text-violet-700",
};

const buttonToneClass: Record<ButtonTone, string> = {
  primary: "border-cyan-500 bg-cyan-500 text-white hover:bg-cyan-600 hover:border-cyan-600",
  secondary: "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
  ghost: "border-transparent bg-white/60 text-slate-700 hover:bg-white",
  danger: "border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600",
};

export function AppCard({
  children,
  className,
  tone = "neutral",
  ...props
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "info";
} & HTMLAttributes<HTMLElement>) {
  const toneClass =
    tone === "info" ? "border-cyan-100 bg-cyan-50/85" : "border-stone-100 bg-white";
  return (
    <section
      {...props}
      className={joinClasses("rounded-3xl border p-5 shadow-sm", toneClass, className)}
    >
      {children}
    </section>
  );
}

export function AppButton({
  className,
  tone = "primary",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return (
    <button
      {...props}
      className={joinClasses(
        "rounded-xl border px-4 py-2 text-sm font-bold transition disabled:opacity-60",
        buttonToneClass[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={joinClasses(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black",
        badgeToneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
