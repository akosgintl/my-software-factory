/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // The app is personal and local: it is served on 127.0.0.1 only (see scripts/app-control.mjs).
  // Reminder data is read from SQLite at request time; nothing here opts any route into caching.
};

export default nextConfig;
