"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import Button from "@/components/ui/button";

type AuthFormShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

/**
 * Shared chrome for login / signup / forgot-password forms.
 */
export function AuthFormShell({
  title,
  subtitle,
  children,
  footer,
}: AuthFormShellProps) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-5 py-12">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,184,168,0.12)_0%,transparent_65%)] blur-2xl" />
      </div>

      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-block font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-accent"
        >
          Atlas
        </Link>

        <div className="rounded-2xl border border-border bg-surface/60 p-6 sm:p-8">
          <h1 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
};

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required = true,
}: AuthFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
};

/** Password input with show / hide toggle. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required = true,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          required={required}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-border bg-background/80 py-2.5 pl-3 pr-16 text-sm text-foreground outline-none transition-all placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

type AuthFormProps = {
  children: ReactNode;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error?: string | null;
  success?: string | null;
};

export function AuthForm({
  children,
  submitLabel,
  loading,
  onSubmit,
  error,
  success,
}: AuthFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {children}
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-accent" role="status">
          {success}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background"
              aria-hidden="true"
            />
            Please wait…
          </span>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
