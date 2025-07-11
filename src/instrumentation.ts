const {
  OTLPMetricExporter,
} = require("@opentelemetry/exporter-metrics-otlp-http");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
const { NodeSDK } = require("@opentelemetry/sdk-node");

// Configure OTLP exporter to push metrics to external OTEL collector
const otlpMetricExporter = new OTLPMetricExporter({
  url:
    process.env["METRICS_EXPORTER_ENDPOINT"] ||
    "http://host.docker.internal:4318/v1/metrics",
});

// Create a periodic metric reader that pushes metrics every second
const metricReader = new PeriodicExportingMetricReader({
  exporter: otlpMetricExporter,
  exportIntervalMillis: process.env["METRICS_INTERVAL_MS"] || 1000,
});

const sdk = new NodeSDK({
  metricReader,
});

sdk.start();
