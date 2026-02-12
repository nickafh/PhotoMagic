"use client";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const styles = {
    DRAFT: {
      bg: "bg-slate-100 dark:bg-slate-700/50",
      text: "text-slate-600 dark:text-slate-300",
      dot: "bg-slate-400",
      border: "border-slate-200 dark:border-slate-600",
      label: "Draft",
    },
    SUBMITTED: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
      border: "border-amber-200 dark:border-amber-700/50",
      label: "Submitted",
      pulse: true,
    },
    APPROVED: {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      text: "text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500",
      border: "border-emerald-200 dark:border-emerald-700/50",
      label: "Approved",
    },
  };

  const style = styles[status as keyof typeof styles] || styles.DRAFT;
  const isPulsing = "pulse" in style && style.pulse;

  const sizeClasses = {
    sm: "px-2.5 py-1 text-[10px]",
    md: "px-3 py-1.5 text-xs",
    lg: "px-4 py-2 text-sm",
  }[size];

  const dotSize = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  }[size];

  return (
    <span
      className={`
        status-${status.toLowerCase()}
        inline-flex items-center gap-2 rounded-full
        font-semibold uppercase tracking-wider
        border backdrop-blur-sm
        ${style.bg} ${style.text} ${style.border} ${sizeClasses}
      `}
    >
      <span
        className={`
          status-dot ${dotSize} rounded-full ${style.dot}
          ${isPulsing ? "animate-pulse" : ""}
        `}
      />
      {style.label}
    </span>
  );
}
