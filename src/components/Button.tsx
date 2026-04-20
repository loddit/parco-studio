import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
  }
>;

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-xl px-1 py-1 text-[13px] font-bold transition focus:outline-none focus:ring-2 focus:ring-sky-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-sky-500 text-white shadow-lg shadow-sky-500/25 hover:bg-sky-600",
        variant === "secondary" &&
          "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
