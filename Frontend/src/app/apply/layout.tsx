import { Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";

const applySerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

export default function ApplyLayout({ children }: { children: ReactNode }) {
  return <div className={`${applySerif.className} min-h-svh`}>{children}</div>;
}
