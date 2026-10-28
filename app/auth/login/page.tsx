import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

/** Messages for redirects that come back with an `error` code. */
const ERROR_MESSAGES: Record<string, string> = {
  google: "Google sign-in was cancelled or failed. Please try again.",
  config: "Authentication is not configured on the server.",
  auth: "That sign-in link is invalid or has expired. Please try again.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const errorCode = typeof params.error === "string" ? params.error : undefined;

  return (
    <AuthShell>
      <LoginForm
        next={next}
        initialError={
          errorCode
            ? (ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Please try again.")
            : undefined
        }
      />
    </AuthShell>
  );
}
