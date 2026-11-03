"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "dark" | "stone" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export function Button({
  className,
  variant = "stone",
  size = "md",
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-orange text-ink shadow-[0_8px_20px_-8px_rgba(255,90,0,0.75)] hover:bg-[#ff6d1f] active:bg-[#e85100] border border-[#e24f00]",
    dark: "bg-ink text-canvas hover:bg-[#2c2c2c] active:bg-black border border-black",
    stone:
      "bg-canvas text-ink border border-[#dedad2] shadow-neu-sm hover:shadow-neu-md hover:bg-white active:shadow-neu-inset",
    outline:
      "bg-transparent text-ink border border-[#cfcabf] hover:bg-white hover:border-[#b9b3a7]",
    ghost: "bg-transparent text-ink hover:bg-black/[0.055]",
    danger:
      "bg-danger text-white hover:bg-[#a3342d] border border-[#9f312a]",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-[13px] gap-1.5 rounded-[10px]",
    md: "h-11 px-4 text-sm gap-2 rounded-xl",
    lg: "h-12 px-5 text-[15px] gap-2 rounded-2xl",
    icon: "h-11 w-11 rounded-xl",
  };

  return (
    <button
      type="button"
      className={cn(
        "relative inline-flex select-none items-center justify-center font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "orange" | "yellow";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-[#eeeeeb] text-[#4b4843] border-[#d9d5cd]",
  success: "bg-[#e5f3ec] text-[#1c6142] border-[#bfdccd]",
  warning: "bg-[#fff3cf] text-[#775000] border-[#ecdba4]",
  danger: "bg-[#fbe9e7] text-[#8f2f28] border-[#ecc9c4]",
  info: "bg-[#e9f1fa] text-[#1e5688] border-[#c4d9ef]",
  orange: "bg-[#ffe7d9] text-[#a63b00] border-[#f6c8ad]",
  yellow: "bg-yellow text-ink border-[#e7c95c]",
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none tracking-[0.01em]",
        toneStyles[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Switch                                                                     */
/* -------------------------------------------------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  return (
    <div className="flex items-start justify-between gap-5 py-3.5">
      <div className="min-w-0">
        <label
          htmlFor={switchId}
          className="cursor-pointer text-[13px] font-medium leading-snug text-ink"
        >
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 max-w-lg text-[11.5px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-40",
          checked
            ? "border-[#e24f00] bg-orange"
            : "border-[#d4cec3] bg-[#e7e3db]",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] flex h-[20px] w-[20px] items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              checked ? "bg-orange" : "bg-[#b6afa3]",
            )}
          />
        </span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card / section heading                                                     */
/* -------------------------------------------------------------------------- */

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-[#e3dfd7] bg-white shadow-neu-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {(index || eyebrow) && (
        <div className="flex items-center gap-3">
          {index ? (
            <span className="font-mono text-[11px] text-orange">[{index}]</span>
          ) : null}
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        </div>
      )}
      <h2 className="display max-w-3xl text-[clamp(2.2rem,4.4vw,4rem)] text-balance">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted text-pretty">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export function Progress({
  value,
  tone = "orange",
  label,
  className,
}: {
  value: number;
  tone?: "orange" | "dark" | "success";
  label?: string;
  className?: string;
}) {
  const bg = tone === "success" ? "bg-success" : tone === "dark" ? "bg-ink" : "bg-orange";
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>{label}</span>
          <span className="tabular font-medium text-ink">{value}%</span>
        </div>
      ) : null}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8e4dc]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", bg)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  initials,
  size = "md",
  hue = "stone",
  className,
}: {
  name: string;
  initials?: string;
  size?: "sm" | "md" | "lg";
  hue?: "orange" | "stone" | "yellow" | "ink";
  className?: string;
}) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-[11px]",
    lg: "h-12 w-12 text-sm",
  };
  const hues = {
    orange: "bg-[#ffe2d2] text-[#9c3900] border-[#f5c7ab]",
    stone: "bg-stone text-ink border-[#d6d1c7]",
    yellow: "bg-yellow text-ink border-[#e5c95e]",
    ink: "bg-ink text-canvas border-black",
  };
  const label =
    initials ??
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tracking-wide",
        sizes[size],
        hues[hue],
        className,
      )}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[26px] border border-[#ded9cf] bg-canvas shadow-[0_40px_90px_-30px_rgba(0,0,0,0.5)] sm:rounded-[26px]",
              widths[size],
            )}
            initial={{ opacity: 0, y: 26, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-6 border-b border-[#e2ded6] bg-white px-6 py-5">
              <div>
                <h3 id={titleId} className="text-lg font-semibold tracking-tight">
                  {title}
                </h3>
                {description ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e1ddd5] bg-canvas text-muted transition hover:bg-stone hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e2ded6] bg-white px-6 py-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[85]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-[#ded9cf] bg-canvas shadow-2xl"
            initial={{ x: 40, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 50, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e2ded6] bg-white px-6 py-5">
              <div>
                <p className="eyebrow mb-2">Detail</p>
                <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                {subtitle ? (
                  <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
                ) : null}
              </div>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e1ddd5] bg-canvas text-muted transition hover:bg-stone hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer ? (
              <div className="border-t border-[#e2ded6] bg-white px-6 py-4">
                {footer}
              </div>
            ) : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7d2c8] bg-[#fbfaf8] text-center",
        compact ? "px-4 py-6" : "px-6 py-12",
      )}
    >
      {icon ? (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-stone text-muted">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                     */
/* -------------------------------------------------------------------------- */

type ToastTone = "success" | "error" | "info";
type Toast = { id: string; title: string; detail?: string; tone: ToastTone };

const ToastContext = createContext<{
  push: (toast: Omit<Toast, "id">) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4800);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(92vw,380px)] flex-col gap-2.5"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[#dcd7cd] bg-white p-3.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.4)]"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  toast.tone === "success" && "bg-[#e5f3ec] text-success",
                  toast.tone === "error" && "bg-[#fbe9e7] text-danger",
                  toast.tone === "info" && "bg-[#fff3cf] text-warning",
                )}
              >
                {toast.tone === "success" ? (
                  <Check size={14} strokeWidth={2.5} />
                ) : toast.tone === "error" ? (
                  <AlertTriangle size={14} />
                ) : (
                  <Info size={14} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug">{toast.title}</p>
                {toast.detail ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {toast.detail}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() =>
                  setToasts((current) =>
                    current.filter((item) => item.id !== toast.id),
                  )
                }
                className="text-muted transition hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
