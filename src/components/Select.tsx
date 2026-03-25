import { IconCheck, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import clsx from "clsx";
import {
  Children,
  type ChangeEvent,
  forwardRef,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

type OptionItem = {
  disabled: boolean;
  label: string;
  value: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    children,
    className,
    disabled = false,
    name,
    onBlur,
    onChange,
    required,
    value,
    defaultValue,
    ...props
  },
  ref,
) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(() => getOptions(children), [children]);
  const initialValue = useMemo(
    () => String(value ?? defaultValue ?? options.find((option) => !option.disabled)?.value ?? ""),
    [defaultValue, options, value],
  );
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    getSelectedIndex(options, isControlled ? String(value) : initialValue),
  );

  const selectedValue = isControlled ? String(value ?? "") : internalValue;
  const selectedIndex = getSelectedIndex(options, selectedValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  useEffect(() => {
    if (!isControlled) {
      return;
    }

    setHighlightedIndex(getSelectedIndex(options, String(value ?? "")));
  }, [isControlled, options, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function handleSelect(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    setHighlightedIndex(getSelectedIndex(options, nextValue));
    setIsOpen(false);

    onChange?.({
      target: { value: nextValue, name } as EventTarget & HTMLSelectElement,
      currentTarget: { value: nextValue, name } as EventTarget & HTMLSelectElement,
    } as ChangeEvent<HTMLSelectElement>);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || options.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => getNextEnabledIndex(options, current, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => getNextEnabledIndex(options, current, -1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(selectedIndex);
        return;
      }

      const highlightedOption = options[highlightedIndex];
      if (highlightedOption && !highlightedOption.disabled) {
        handleSelect(highlightedOption.value);
      }
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <select
        {...props}
        aria-hidden="true"
        className="sr-only"
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        onBlur={onBlur}
        onChange={() => {}}
        ref={ref}
        required={required}
        tabIndex={-1}
        value={selectedValue}
      >
        {children}
      </select>

      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={clsx(
          "flex w-full items-center gap-3 rounded-xl border border-sky-200/80 bg-white/92 px-4 py-2 text-left text-slate-900 shadow-[0_10px_28px_rgba(14,165,233,0.08)] outline-none transition-all duration-200 hover:border-sky-300 hover:bg-white focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none",
          className,
        )}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
            setHighlightedIndex(selectedIndex);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label ?? ""}</span>
        <span className="pointer-events-none relative h-5 w-5 shrink-0 text-sky-500">
          <IconChevronDown
            aria-hidden="true"
            className={clsx(
              "absolute inset-0 transition-all duration-200",
              isOpen ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100",
            )}
            size={18}
            stroke={2}
          />
          <IconChevronUp
            aria-hidden="true"
            className={clsx(
              "absolute inset-0 transition-all duration-200",
              isOpen ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
            size={18}
            stroke={2}
          />
        </span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-50 overflow-hidden rounded-[24px] border border-sky-200/80 bg-white/96 p-2 shadow-[0_22px_60px_rgba(15,23,42,0.16)] backdrop-blur">
          <ul
            aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-${highlightedIndex}` : undefined}
            className="max-h-72 space-y-1 overflow-y-auto"
            id={listboxId}
            role="listbox"
          >
            {options.map((option, index) => {
              const isSelected = option.value === selectedValue;
              const isHighlighted = index === highlightedIndex;

              return (
                <li key={option.value} role="presentation">
                  <button
                    aria-selected={isSelected}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition cursor-pointer",
                      option.disabled
                        ? "cursor-not-allowed text-slate-300"
                        : "text-slate-700 hover:bg-sky-50/90 hover:text-slate-900",
                      isHighlighted && !option.disabled && "bg-sky-50 text-slate-900",
                      isSelected && !option.disabled && "bg-sky-500 text-white hover:bg-sky-500 hover:text-white",
                    )}
                    disabled={option.disabled}
                    id={`${listboxId}-${index}`}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    type="button"
                  >
                    <span className="text-sm min-w-0 flex-1 truncate">{option.label}</span>
                    <IconCheck
                      aria-hidden="true"
                      className={clsx(
                        "shrink-0 transition-opacity",
                        isSelected && !option.disabled ? "opacity-100" : "opacity-0",
                      )}
                      size={16}
                      stroke={2.2}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
});

function getOptions(children: SelectProps["children"]): OptionItem[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) {
      return [];
    }

    if (child.type !== "option") {
      return [];
    }

    const option = child as ReactElement<{
      children?: ReactNode;
      disabled?: boolean;
      value?: string;
    }>;

    return [
      {
        disabled: Boolean(option.props.disabled),
        label: getOptionLabel(option.props.children),
        value: String(option.props.value ?? ""),
      },
    ];
  });
}

function getOptionLabel(children: ReactNode) {
  return Children.toArray(children)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("");
}

function getSelectedIndex(options: OptionItem[], value: string) {
  const exactMatchIndex = options.findIndex((option) => option.value === value);
  if (exactMatchIndex >= 0) {
    return exactMatchIndex;
  }

  return options.findIndex((option) => !option.disabled);
}

function getNextEnabledIndex(options: OptionItem[], currentIndex: number, direction: 1 | -1) {
  if (options.length === 0) {
    return -1;
  }

  let nextIndex = currentIndex;

  for (let step = 0; step < options.length; step += 1) {
    nextIndex = (nextIndex + direction + options.length) % options.length;
    if (!options[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return currentIndex;
}
