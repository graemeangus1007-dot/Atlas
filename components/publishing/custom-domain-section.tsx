"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import { normalizeAndValidateHostname } from "@/lib/domains/hostname";
import {
  resolveActiveCustomDomainUrl,
  shouldPollDomainStatus,
} from "@/lib/domains/status";
import type {
  DomainDnsRecord,
  DomainMigrationState,
  ProjectDomainStatus,
} from "@/lib/domains/types";

const POLL_INTERVAL_MS = 15_000;

type PublicDomain = {
  id: string;
  projectId: string;
  hostname: string;
  normalizedHostname: string;
  domainType: "apex" | "subdomain";
  status: ProjectDomainStatus | string;
  verificationMethod: string;
  verificationRecords: DomainDnsRecord[];
  provider: string;
  failureReason: string | null;
  verifiedAt?: string | null;
  activatedAt?: string | null;
  lastCheckedAt?: string | null;
  linkedProjectId?: string | null;
  linkedProjectName?: string | null;
  migrationState?: DomainMigrationState | string;
  linkedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending DNS";
    case "verifying":
      return "Verifying";
    case "ssl_provisioning":
      return "SSL Provisioning";
    case "verified":
      return "SSL Provisioning";
    case "active":
      return "Active";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "active":
      return "border-accent/40 bg-accent-soft text-accent";
    case "failed":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    case "ssl_provisioning":
    case "verified":
    case "verifying":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    default:
      return "border-border text-muted";
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Custom Domain section — verify / SSL / active with 15s polling while open.
 */
export default function CustomDomainSection() {
  const { projectId } = useProject();
  const [hostnameInput, setHostnameInput] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [domain, setDomain] = useState<PublicDomain | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [linking, setLinking] = useState(false);
  const mountedRef = useRef(true);
  const domainRef = useRef<PublicDomain | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    domainRef.current = domain;
  }, [domain]);

  const loadDomain = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!projectId) {
      setDomain(null);
      return;
    }
    if (!opts?.quiet) {
      setLoading(true);
      setServerError(null);
    }
    try {
      const res = await fetch(
        `/api/domains?projectId=${encodeURIComponent(projectId)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const data = (await res.json()) as {
        domains?: PublicDomain[];
        error?: string;
      };
      if (!mountedRef.current) return;
      if (!res.ok) {
        if (!opts?.quiet) {
          setServerError(data.error || "Could not load domains.");
        }
        setDomain(null);
        return;
      }
      setDomain(data.domains?.[0] ?? null);
    } catch {
      if (mountedRef.current) {
        if (!opts?.quiet) setServerError("Could not load domains.");
        setDomain(null);
      }
    } finally {
      if (mountedRef.current && !opts?.quiet) setLoading(false);
    }
  }, [projectId]);

  const runVerify = useCallback(async (domainId: string, silent = false) => {
    if (!silent) {
      setVerifying(true);
      setServerError(null);
      // Optimistic UI — leave Pending DNS immediately while the request runs.
      setDomain((prev) =>
        prev && prev.id === domainId
          ? { ...prev, status: "verifying", failureReason: null }
          : prev,
      );
    }
    try {
      const res = await fetch(
        `/api/domains/${encodeURIComponent(domainId)}/verify`,
        { method: "POST", credentials: "same-origin" },
      );
      const data = (await res.json()) as {
        domain?: PublicDomain;
        error?: string;
      };
      if (!mountedRef.current) return;

      // Apply verify payload immediately, then quiet-reload from GET so the
      // panel always reflects project_domains after the write.
      if (data.domain) setDomain(data.domain);

      if (!res.ok) {
        if (!silent) {
          setServerError(
            data.error ||
              data.domain?.failureReason ||
              "Verification failed.",
          );
        }
        await loadDomain({ quiet: true });
        return;
      }

      await loadDomain({ quiet: true });
    } catch {
      if (mountedRef.current && !silent) {
        setServerError("Verification failed.");
      }
      await loadDomain({ quiet: true });
    } finally {
      if (mountedRef.current && !silent) setVerifying(false);
    }
  }, [loadDomain]);

  useEffect(() => {
    void loadDomain();
  }, [loadDomain]);

  // Poll every ~15s while panel is mounted and domain is in-progress.
  useEffect(() => {
    if (
      !domain ||
      !shouldPollDomainStatus(domain.status, domain.migrationState)
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      const current = domainRef.current;
      if (
        !current ||
        !shouldPollDomainStatus(current.status, current.migrationState)
      ) {
        return;
      }
      void runVerify(current.id, true);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [domain?.id, domain?.status, domain?.migrationState, runVerify]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setClientError(null);
    setServerError(null);

    if (!projectId) {
      setClientError("Save your project before connecting a domain.");
      return;
    }

    const validated = normalizeAndValidateHostname(hostnameInput);
    if (!validated.ok) {
      setClientError(validated.error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          hostname: hostnameInput,
        }),
      });
      const data = (await res.json()) as {
        domain?: PublicDomain;
        error?: string;
        requiresLinkConfirmation?: boolean;
      };
      if (!res.ok) {
        setServerError(data.error || "Could not save domain.");
        return;
      }
      setDomain(data.domain ?? null);
      setHostnameInput("");
    } catch {
      setServerError("Could not save domain.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkProject() {
    if (!domain) return;
    setLinking(true);
    setServerError(null);
    try {
      const res = await fetch(
        `/api/domains/${encodeURIComponent(domain.id)}/link`,
        { method: "POST", credentials: "same-origin" },
      );
      const data = (await res.json()) as {
        domain?: PublicDomain;
        error?: string;
      };
      if (!mountedRef.current) return;
      if (data.domain) setDomain(data.domain);
      if (!res.ok) {
        setServerError(data.error || "Could not link project.");
        await loadDomain({ quiet: true });
        return;
      }
      await loadDomain({ quiet: true });
    } catch {
      if (mountedRef.current) {
        setServerError("Could not link project.");
      }
      await loadDomain({ quiet: true });
    } finally {
      if (mountedRef.current) setLinking(false);
    }
  }

  async function handleCancelLink() {
    // Cancel = remove Atlas row only (provider detach skipped for detected).
    await handleRemove();
  }

  async function handleRemove() {
    if (!domain) return;
    setRemoving(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/domains/${encodeURIComponent(domain.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setServerError(data.error || "Could not remove domain.");
        return;
      }
      setDomain(null);
      setConfirmRemove(false);
    } catch {
      setServerError("Could not remove domain.");
    } finally {
      setRemoving(false);
    }
  }

  async function handleCopy(key: string, value: string) {
    const ok = await copyText(value);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1200);
    }
  }

  const awaitingLink = domain?.migrationState === "detected";
  const isLinked =
    domain?.migrationState === "linked" ||
    domain?.migrationState === "migrated";
  const activeUrl =
    domain?.status === "active"
      ? resolveActiveCustomDomainUrl(domain.hostname)
      : null;
  const showDns =
    domain &&
    !awaitingLink &&
    domain.status !== "active" &&
    domain.verificationRecords.length > 0;

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="text-sm font-semibold text-foreground">Custom Domain</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Connect a domain like <span className="font-mono">www.example.com</span>.
        Verify DNS, wait for SSL, then publish will use your custom URL.
      </p>

      {!projectId ? (
        <p className="mt-3 text-xs text-amber-200">
          Open a saved project to manage custom domains.
        </p>
      ) : null}

      {loading ? (
        <p className="mt-3 text-xs text-muted">Loading domain…</p>
      ) : null}

      {clientError || serverError ? (
        <p className="mt-3 text-xs text-red-400" role="alert">
          {clientError || serverError}
        </p>
      ) : null}

      {!domain && projectId ? (
        <form className="mt-3 space-y-2" onSubmit={(e) => void handleSave(e)}>
          <label className="block text-xs text-muted" htmlFor="custom-domain">
            Hostname
          </label>
          <input
            id="custom-domain"
            type="text"
            value={hostnameInput}
            onChange={(e) => {
              setHostnameInput(e.target.value);
              setClientError(null);
            }}
            placeholder="www.example.com"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent"
          />
          <Button
            type="submit"
            variant="secondary"
            className="w-full px-3 py-2 text-xs"
            disabled={saving || !hostnameInput.trim()}
          >
            {saving ? "Saving…" : "Save domain"}
          </Button>
        </form>
      ) : null}

      {domain ? (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-background/50 p-3">
          <div>
            <p className="text-xs text-muted">Hostname</p>
            <p className="mt-0.5 break-all font-mono text-sm text-foreground">
              {domain.hostname}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-md border px-2 py-0.5 ${statusTone(
                awaitingLink ? "verifying" : domain.status,
              )}`}
            >
              {awaitingLink
                ? "Existing project"
                : isLinked
                  ? "Linked"
                  : statusLabel(domain.status)}
            </span>
            <span className="rounded-md border border-border px-2 py-0.5 text-muted">
              {domain.domainType}
            </span>
          </div>

          {awaitingLink ? (
            <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold text-amber-100">
                This domain is already connected to:
              </p>
              <p className="break-all font-mono text-sm text-foreground">
                {domain.linkedProjectName || domain.linkedProjectId}
              </p>
              <p className="text-xs leading-relaxed text-amber-100/90">
                Link this existing Vercel project? Your website stays live —
                no DNS changes and no downtime. Normal Publish still deploys
                to Atlas preview hosting; production cutover requires an
                explicit Publish to Production step.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1 px-3 py-2 text-xs"
                  disabled={linking || removing}
                  onClick={() => void handleLinkProject()}
                >
                  {linking ? "Linking…" : "Link Project"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 px-3 py-2 text-xs"
                  disabled={linking || removing}
                  onClick={() => void handleCancelLink()}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {domain.status === "active" && activeUrl ? (
            <div className="rounded-lg border border-accent/30 bg-accent-soft/40 p-3">
              <p className="text-xs font-semibold text-accent">Connected</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">
                {activeUrl}
              </p>
              {isLinked && domain.linkedProjectName ? (
                <p className="mt-2 text-[11px] text-muted">
                  Linked production project{" "}
                  <span className="font-mono text-foreground">
                    {domain.linkedProjectName}
                  </span>
                  . Normal Publish does not overwrite it.
                </p>
              ) : null}
              <Button
                href={activeUrl}
                variant="ghost"
                className="mt-3 w-full px-3 py-2 text-xs"
              >
                Visit Website
              </Button>
            </div>
          ) : null}

          {!awaitingLink && domain.failureReason ? (
            <p className="text-xs text-red-400" role="alert">
              {domain.failureReason}
            </p>
          ) : null}

          {!awaitingLink &&
          (domain.status === "ssl_provisioning" ||
            domain.status === "verified") ? (
            <p className="text-xs text-amber-200">
              Ownership verified. Waiting for SSL certificate and DNS to finish
              propagating…
            </p>
          ) : null}

          {!awaitingLink && domain.status === "verifying" ? (
            <p className="text-xs text-muted">Checking DNS records…</p>
          ) : null}

          {!awaitingLink &&
          domain.status === "pending" &&
          !domain.lastCheckedAt ? (
            <p className="text-xs text-muted">
              Configure the DNS records below, then click Verify Now.
            </p>
          ) : null}

          {!awaitingLink && domain.lastCheckedAt ? (
            <p className="text-[11px] text-muted">
              Last checked{" "}
              {new Date(domain.lastCheckedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}

          {showDns ? (
            <div>
              <p className="text-xs font-medium text-foreground">
                DNS records to configure
              </p>
              <ul className="mt-2 space-y-2">
                {domain.verificationRecords.map((record, index) => {
                  const baseKey = `${record.type}-${index}`;
                  return (
                    <li
                      key={baseKey}
                      className="rounded-lg border border-border/80 bg-surface/40 p-2 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {record.type}
                        </span>
                        <button
                          type="button"
                          className="text-accent hover:underline"
                          onClick={() =>
                            void handleCopy(`${baseKey}-type`, record.type)
                          }
                        >
                          {copiedKey === `${baseKey}-type`
                            ? "Copied"
                            : "Copy type"}
                        </button>
                      </div>
                      <div className="mt-1 flex items-start justify-between gap-2">
                        <p className="min-w-0">
                          <span className="text-muted">Name </span>
                          <span className="break-all font-mono text-foreground">
                            {record.name}
                          </span>
                        </p>
                        <button
                          type="button"
                          className="shrink-0 text-accent hover:underline"
                          onClick={() =>
                            void handleCopy(`${baseKey}-name`, record.name)
                          }
                        >
                          {copiedKey === `${baseKey}-name` ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="mt-1 flex items-start justify-between gap-2">
                        <p className="min-w-0">
                          <span className="text-muted">Value </span>
                          <span className="break-all font-mono text-foreground">
                            {record.value}
                          </span>
                        </p>
                        <button
                          type="button"
                          className="shrink-0 text-accent hover:underline"
                          onClick={() =>
                            void handleCopy(`${baseKey}-value`, record.value)
                          }
                        >
                          {copiedKey === `${baseKey}-value` ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {!awaitingLink && domain.status !== "active" ? (
            <Button
              type="button"
              className="w-full px-3 py-2 text-xs"
              disabled={verifying}
              onClick={() => void runVerify(domain.id, false)}
            >
              {verifying
                ? "Verifying…"
                : domain.status === "failed"
                  ? "Retry Verification"
                  : "Verify Now"}
            </Button>
          ) : null}

          {!awaitingLink && confirmRemove ? (
            <div className="rounded-lg border border-border p-2">
              <p className="text-xs text-muted">
                Remove <span className="font-mono">{domain.hostname}</span> from
                Atlas?
                {isLinked
                  ? " The live website stays online on Vercel — only the Atlas link is removed."
                  : domain.status === "active"
                    ? " The live custom domain will stop working for this project."
                    : " You can add it again later."}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  className="flex-1 px-3 py-2 text-xs"
                  disabled={removing}
                  onClick={() => void handleRemove()}
                >
                  {removing ? "Removing…" : "Confirm remove"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 px-3 py-2 text-xs"
                  disabled={removing}
                  onClick={() => setConfirmRemove(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : !awaitingLink ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full px-3 py-2 text-xs"
              onClick={() => setConfirmRemove(true)}
            >
              Remove domain
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
