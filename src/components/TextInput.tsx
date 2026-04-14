import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...props }: TextInputProps) {
  return (
    <input
      className={clsx(
        "w-full rounded-lg border border-sky-100 bg-white px-2 py-1 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
        className,
      )}
      {...props}
    />
  );
}
