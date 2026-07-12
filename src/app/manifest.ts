import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loyalty Scan",
    short_name: "Loyalty Scan",
    description: "Scan customer loyalty IDs, award points, and redeem rewards.",
    start_url: "/scan",
    display: "standalone",
    background_color: "#f7faf8",
    theme_color: "#16814b",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
