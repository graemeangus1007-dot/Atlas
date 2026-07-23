"use client";

import type { ReactNode } from "react";
import { useAuthRedirect } from "@/hooks/use-auth-redirect";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { ProjectProvider } from "@/context/project-context";
import { TemplateProvider } from "@/context/template-context";

type ProvidersProps = {
  children: ReactNode;
};

function AuthRedirectBridge({ children }: { children: ReactNode }) {
  useAuthRedirect();
  return children;
}

/**
 * Root client providers — AuthProvider owns session state across refreshes.
 */
export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <AuthRedirectBridge>
        <ProjectProvider>
          <TemplateProvider>{children}</TemplateProvider>
        </ProjectProvider>
      </AuthRedirectBridge>
    </AuthProvider>
  );
}
