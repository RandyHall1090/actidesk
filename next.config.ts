import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, too small for real marketing PDFs/images uploaded
      // to the asset library (uploadFileAsset in library/actions.ts) --
      // requests over the limit fail at the framework level before our
      // code runs, surfacing as a hard client error instead of a normal
      // form validation message.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
