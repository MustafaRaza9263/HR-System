import type { Metadata } from "next";

import { CareersBoard } from "@/components/careers/careers-board";

export const metadata: Metadata = {
  title: "Careers",
  description: "Browse open roles and join our team.",
};

export default function HomePage() {
  return <CareersBoard />;
}
