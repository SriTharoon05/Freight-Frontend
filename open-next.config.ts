import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// FreightOS has no ISR/`use cache` pages that need a shared cache, so the
// default (no incremental cache binding) keeps the setup free-tier friendly.
export default defineCloudflareConfig();
