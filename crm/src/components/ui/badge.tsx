import { cn } from "@/lib/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "destructive" | "warning" | "success" | "outline";
  className?: string;
}

const variants: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-amber-100 text-amber-800",
  success: "bg-green-100 text-green-800",
  outline: "border border-border text-muted-foreground",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
      variants[variant],
      className,
    )}>
      {children}
    </span>
  );
}
