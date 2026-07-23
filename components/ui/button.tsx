import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type SharedProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

type LinkButtonProps = SharedProps & {
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  disabled?: never;
  type?: never;
};

type NativeButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: never;
  };

export type ButtonProps = LinkButtonProps | NativeButtonProps;

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-background hover:bg-accent-hover hover:shadow-[0_0_0_1px_var(--accent-hover),0_8px_24px_rgba(61,184,168,0.25)] active:scale-[0.98] active:bg-accent-hover disabled:hover:shadow-none disabled:active:scale-100",
  secondary:
    "border border-border bg-transparent text-foreground hover:border-accent/50 hover:bg-white/[0.03] active:scale-[0.98] active:bg-white/[0.06]",
  ghost:
    "border border-border bg-transparent text-foreground hover:border-accent hover:text-accent active:scale-[0.98] active:bg-accent-soft",
};

const BASE_STYLES =
  "inline-flex cursor-pointer items-center justify-center rounded-xl px-6 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent";

/**
 * Shared button primitive.
 * - Pass `href` to render a Next.js Link (route / hash navigation).
 * - Omit `href` to render a native <button> (forms / onboarding).
 */
export default function Button(props: ButtonProps) {
  const { children, variant = "primary", className = "" } = props;
  const classes = `${BASE_STYLES} ${VARIANT_STYLES[variant]} ${className}`;

  if ("href" in props && props.href) {
    const { href, onClick } = props;
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  }

  const {
    type = "button",
    disabled,
    onClick,
    ...rest
  } = props as NativeButtonProps;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
}
