import type { Metadata } from "next";
import SignupForm from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create Account — Atlas",
  description: "Create an Atlas account.",
};

export default function SignupPage() {
  return <SignupForm />;
}
