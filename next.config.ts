import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, too small for real marketing PDFs/images uploaded
      // to the asset library (uploadFileAsset in library/actions.ts) --
      // requests over the limit fail at the framework level before our
      // code runs, surfacing as a hard client error instead of a normal
      // form validation message. First bumped to 20mb, but real files
      // landing close to that cap still failed -- multipart/form-data
      // overhead (boundaries, headers) pushes the raw request body a bit
      // past the file's own size, so the limit needs real headroom above
      // the largest files actually being uploaded, not just match them.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
