import "@sentry/node/import";
import "dotenv/config";
import { initMonitoringFromEnv } from "./lib/monitoring.js";

initMonitoringFromEnv();
