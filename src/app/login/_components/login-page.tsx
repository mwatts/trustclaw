"use client";

// eslint-disable-next-line no-restricted-imports -- local UI state for Google sign-in loading and error
import { useState } from "react";
import { TrustClawBrand } from "~/app/_components/trustclaw-brand";
import { Button } from "~/components/ui/button";
import { authClient } from "~/clients/auth/react";

export function LoginPage() {
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setGooglePending(true);
    setGoogleError(null);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });

    if (result.error) {
      setGoogleError("Something went wrong. Please try again.");
      setGooglePending(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center">
      <div className="mx-auto w-full max-w-sm px-4">
        <div className="mb-8 flex justify-center">
          <TrustClawBrand size="lg" logoLink="/" />
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Sign in</h2>
              <p className="text-muted-foreground text-sm">
                to continue to TrustClaw
              </p>
            </div>

            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                disabled={googlePending}
                onClick={handleGoogleSignIn}
              >
                {googlePending ? (
                  "Redirecting..."
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              {googleError && (
                <p className="text-destructive text-center text-sm">
                  {googleError}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
