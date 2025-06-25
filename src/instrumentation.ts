const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const {
  OTLPMetricExporter,
} = require("@opentelemetry/exporter-metrics-otlp-http");
const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-http");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");
const { BatchLogRecordProcessor } = require("@opentelemetry/sdk-logs");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
const { NodeSDK } = require("@opentelemetry/sdk-node");

// Configure OTLP exporter to push metrics to Grafana Alloy
const otlpMetricExporter = new OTLPMetricExporter({
  url: "http://grafana-alloy:4318/v1/metrics", // Grafana Alloy OTLP HTTP endpoint
});

// Configure OTLP exporter to push traces to Grafana Alloy (which forwards to Tempo)
const otlpTraceExporter = new OTLPTraceExporter({
  url: "http://grafana-alloy:4318/v1/traces", // Grafana Alloy OTLP HTTP endpoint
});

// Configure OTLP exporter to push logs to Grafana Alloy (which forwards to Loki)
const otlpLogExporter = new OTLPLogExporter({
  url: "http://grafana-alloy:4318/v1/logs", // Grafana Alloy OTLP HTTP endpoint
});

// Create a periodic metric reader that pushes metrics every second
const metricReader = new PeriodicExportingMetricReader({
  exporter: otlpMetricExporter,
  exportIntervalMillis: process.env["METRICS_INTERVAL_MS"] || 1000,
});

const sdk = new NodeSDK({
  traceExporter: otlpTraceExporter,
  metricReader,
  logRecordProcessors: [new BatchLogRecordProcessor(otlpLogExporter)],
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
