import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password — Atlas",
  description: "Reset your Atlas account password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
