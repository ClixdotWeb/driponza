import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Official Driponza wordmark (from the existing site), re-coloured into the brand palette. */
export function Logo({ tone = "green", className, href = "/" }: { tone?: "green" | "forest" | "ivory"; className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex shrink-0 items-center", className)} aria-label="Driponza – home">
      <Image src={`/brand/wordmark-${tone}.png`} alt="Driponza" width={825} height={149} priority className="h-7 w-auto md:h-8" />
    </Link>
  );
}
