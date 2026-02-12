"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-background-dark dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="relative rounded-2xl bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black/5 dark:ring-white/10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="text-center space-y-8">
            <div>
              <div className="flex justify-center mb-6">
                <div className="rounded-xl bg-primary px-6 py-4 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                  <Image
                    src="/brand/Atlanta Fine Homes_Horz_White.png"
                    alt="Atlanta Fine Homes"
                    width={200}
                    height={48}
                    style={{ height: "48px", width: "auto" }}
                    priority
                  />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 dark:text-white tracking-tight">
                PhotoMagic
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Sign in to manage your photo listings
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 text-left">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error === "OAuthSignin" && "Error starting sign in process."}
                  {error === "OAuthCallback" && "Error during sign in callback."}
                  {error === "Callback" && "Error in authentication callback."}
                  {error === "Default" && "An error occurred during sign in."}
                  {!["OAuthSignin", "OAuthCallback", "Callback", "Default"].includes(error) && error}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => signIn("okta", { callbackUrl })}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-gray-600 hover:border-slate-300 dark:hover:border-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 active:bg-slate-100 dark:active:bg-gray-500 transition-colors duration-200"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 0C5.389 0 0 5.35 0 11.956c0 6.607 5.389 11.957 12 11.957s12-5.35 12-11.957C24 5.35 18.611 0 12 0zm0 4.174c4.314 0 7.826 3.483 7.826 7.782s-3.512 7.783-7.826 7.783-7.826-3.484-7.826-7.783 3.512-7.782 7.826-7.782z" />
                </svg>
                Sign in with Okta
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-gray-400 mt-8">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
