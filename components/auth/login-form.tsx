"use client";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeClosed } from "lucide-react";
import Link from "next/link";
import { googleAction, loginAction } from "@/lib/auth/actions";
import { EMPTY_AUTH_STATE } from "@/lib/auth/types";

interface LoginFormProps extends React.ComponentProps<"div"> {
  /** Post-login destination carried through the auth redirect. */
  next?: string;
  /** Message set by the proxy/callback when a redirect could not complete. */
  initialError?: string;
}

/** Submit button that reflects the parent form's pending state. */
function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Please wait…" : children}
    </Button>
  );
}

export function LoginForm({
  className,
  next,
  initialError,
  ...props
}: LoginFormProps) {
  const [hide, setHide] = useState(true);
  const [state, formAction] = useActionState(
    loginAction,
    initialError ? { error: initialError } : EMPTY_AUTH_STATE,
  );

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Login with your Google account</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <input type="hidden" name="next" value={next ?? ""} />
            <FieldGroup>
              <Field>
                {/* Google shares the form so it can carry the same `next`. */}
                <Button
                  variant="outline"
                  type="submit"
                  formAction={googleAction}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Login with Google
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="m@example.com"
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <div className="relative flex">
                  <Input
                    id="password"
                    name="password"
                    type={hide ? "password" : "text"}
                    autoComplete="current-password"
                    required
                    placeholder="*********"
                  />
                  {hide ? (
                    <EyeClosed
                      className="w-5 h-5 absolute right-2 top-1.5"
                      onClick={() => setHide(false)}
                    />
                  ) : (
                    <Eye
                      className="w-5 h-5 absolute right-2 top-1.5"
                      onClick={() => setHide(true)}
                    />
                  )}
                </div>
              </Field>
              <Field>
                {state.error ? (
                  <p
                    role="alert"
                    className="text-sm font-medium text-destructive"
                  >
                    {state.error}
                  </p>
                ) : null}
                {state.notice ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {state.notice}
                  </p>
                ) : null}
                <SubmitButton>Login</SubmitButton>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <Link href="/auth/signup">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}
