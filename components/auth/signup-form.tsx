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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeClosed } from "lucide-react";
import Link from "next/link";
import { signupAction } from "@/lib/auth/actions";
import { EMPTY_AUTH_STATE } from "@/lib/auth/types";

/** Submit button that reflects the parent form's pending state. */
function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating account…" : children}
    </Button>
  );
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [hide, setHide] = useState(true);
  const [hideConfirm, setHideConfirm] = useState(true);
  const [state, formAction] = useActionState(signupAction, EMPTY_AUTH_STATE);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Ashkan Sadeghi"
                  required
                />
              </Field>
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
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <div className="flex relative">
                      <Input
                        id="password"
                        name="password"
                        type={hide ? "password" : "text"}
                        autoComplete="new-password"
                        placeholder="*******"
                        required
                      />
                      {hide ? (
                        <EyeClosed
                          className="w-5 h-5 absolute top-1.5 right-2"
                          onClick={() => setHide(false)}
                        />
                      ) : (
                        <Eye
                          className="w-5 h-5 absolute top-1.5 right-2"
                          onClick={() => setHide(true)}
                        />
                      )}
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      Confirm Password
                    </FieldLabel>
                    <div className="relative flex">
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type={hideConfirm ? "password" : "text"}
                        autoComplete="new-password"
                        placeholder="*******"
                        required
                      />
                      {hideConfirm ? (
                        <EyeClosed
                          className="w-5 h-5 absolute top-1.5 right-2"
                          onClick={() => setHideConfirm(false)}
                        />
                      ) : (
                        <Eye
                          className="w-5 h-5 absolute top-1.5 right-2"
                          onClick={() => setHideConfirm(true)}
                        />
                      )}
                    </div>
                  </Field>
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
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
                <SubmitButton>Create Account</SubmitButton>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <Link href="/auth/login">Sign in</Link>
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
