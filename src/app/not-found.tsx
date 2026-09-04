import Link from "next/link";

import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="num text-micro font-semibold uppercase tracking-wide text-neutral-400">
        Error 404
      </p>
      <h1 className="text-title font-semibold text-neutral-900">
        This page does not exist
      </h1>
      <p className="max-w-sm text-base text-neutral-500">
        The address may have been mistyped, or the page may have been moved.
      </p>
      <Button asChild variant="primary">
        <Link href="/">Back to the application</Link>
      </Button>
    </main>
  );
}
