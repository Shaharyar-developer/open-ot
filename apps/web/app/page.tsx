import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { WorkingDemo } from "@/components/landing/working-demo";
import { Installation } from "@/components/landing/installation";
import { Packages } from "@/components/landing/packages";
import { Footer } from "@/components/landing/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenOT - Type-Agnostic Operational Transformation Framework",
  description:
    "The OT engine that doesn't assume your deployment. Bring your own backend, network, and data structure. OpenOT handles consistency under chaos.",
  keywords: [
    "operational transformation",
    "OT",
    "real-time collaboration",
    "collaborative editing",
    "offline-first",
    "TypeScript",
  ],
};

export default function Page() {
  return (
    <main>
      <Hero />
      <Features />
      <WorkingDemo />
      <Installation />
      <Packages />
      <Footer />
    </main>
  );
}
