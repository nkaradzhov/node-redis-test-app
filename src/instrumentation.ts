const {
  OTLPMetricExporter,
} = require("@opentelemetry/exporter-metrics-otlp-http");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { resourceFromAttributes } = require("@opentelemetry/resources");
const {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} = require("@opentelemetry/semantic-conventions");

// Get configuration from environment variables
const appName = process.env["APP_NAME"] ?? "node-redis-test";
const version = process.env["VERSION"] ?? "1.0.0";
const exportInterval = parseInt(
  process.env["METRICS_INTERVAL_MS"] ?? "1000",
  10
);

// Configure OTLP exporter to push metrics to external OTEL collector
const otlpMetricExporter = new OTLPMetricExporter({
  url:
    process.env["METRICS_EXPORTER_ENDPOINT"] ||
    "http://host.docker.internal:4318/v1/metrics",
});

// Create a periodic metric reader that pushes metrics every second (as per specification)
const metricReader = new PeriodicExportingMetricReader({
  exporter: otlpMetricExporter,
  exportIntervalMillis: exportInterval,
});

// Configure resource attributes as per Redis Testing Metrics Specification
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: appName,
  [ATTR_SERVICE_VERSION]: version,
});

const sdk = new NodeSDK({
  resource,
  metricReader,
});

sdk.start();
