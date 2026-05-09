"use client";

import dynamic from "next/dynamic";

const TourFrame = dynamic(
  () => import("@/components/tour/TourFrame").then((m) => m.TourFrame),
  { ssr: false },
);

export default function TourPage() {
  return <TourFrame />;
}
