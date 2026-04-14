import type { ReactNode } from "react";

type DashboardPageFrameProps = {
  children: ReactNode;
  className?: string;
};

type DashboardHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
  sticky?: boolean;
  contentClassName?: string;
};

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function DashboardPageFrame({ children, className }: DashboardPageFrameProps) {
  return (
    <div
      className={joinClasses(
        "min-h-screen bg-gradient-to-b from-slate-50 via-cyan-50 to-white font-sans",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashboardHeader({
  title,
  subtitle,
  leftIcon,
  rightSlot,
  className,
  sticky = true,
  contentClassName,
}: DashboardHeaderProps) {
  return (
    <header
      className={joinClasses(
        "border-b border-cyan-100 bg-white/95 shadow-sm backdrop-blur-md",
        sticky ? "sticky top-0 z-20" : undefined,
        className,
      )}
    >
      <div
        className={joinClasses(
          "mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-5",
          contentClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {leftIcon}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-slate-800">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {rightSlot}
      </div>
    </header>
  );
}

export function DashboardNavStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={joinClasses("border-b border-cyan-100 bg-cyan-50/80 px-4 py-2", className)}>
      {children}
    </div>
  );
}
