import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Capital Ark",
    short_name: "Capital Ark",
    description:
      "Track coalition fundraising while contributions go directly to official campaign processors.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1E6851",
    icons: [
      {
        src: "/icons/capital-ark-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/capital-ark-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/capital-ark-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
