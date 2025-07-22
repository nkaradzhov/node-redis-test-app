# Node Redis Test App

A workload runner for testing Node.js Redis client fault tolerance against Redis database upgrades and performance testing.

## Prerequisites

- **Docker**

## Build

Build development image:

```sh
./run.sh build --dev
```

Build production image (default):

```sh
./run.sh build --prod
# or simply
./run.sh build
```

## Usage

Development mode with hot reload:

```sh
./run.sh dev
```

Production mode:

```sh
./run.sh start
```

Local development without Docker:

```sh
./run.sh local
```

Custom workload and configuration:

```sh
./run.sh dev --workload workloads/custom-workload.yaml --replicas 3
```

### Script Usage Examples

Run with custom workload:

```sh
./run.sh start --workload workloads/high-load-test.yaml
```

Development with multiple replicas:

```sh
./run.sh dev --replicas 5
```

Local development with custom workload:

```sh
./run.sh local --workload workloads/high-load-test.yaml
```

Custom run ID for tracking:

```sh
RUN_ID=performance-test-2024 ./run.sh start
```

Combined configuration:

```sh
RUN_ID=cluster-fault-test ./run.sh dev --workload workloads/cluster-test.yaml --replicas 3
```

Enable OpenTelemetry metrics:

```sh
ENABLE_OTEL=true ./run.sh dev
```

Local development with OpenTelemetry:

```sh
ENABLE_OTEL=true ./run.sh local
```

Custom metrics endpoint:

```sh
ENABLE_OTEL=true METRICS_EXPORTER_ENDPOINT=http://my-otel-collector:4318/v1/metrics ./run.sh start
```

### Script Configuration Options

The run.sh script supports the following options:

| Option              | Description                                  | Default Value                       |
| ------------------- | -------------------------------------------- | ----------------------------------- |
| `--workload`, `-w`  | Path to the workload configuration YAML file | `./workloads/example-workload.yaml` |
| `--replicas`, `-r`  | Number of application replicas to run        | `1`                                 |
| `--log-level`, `-l` | Log level (info or error)                    | `info`                              |
| `--help`, `-h`      | Display help message                         |                                     |

### Environment Variables

| Variable                    | Description                                          | Required | Default Value                                 |
| --------------------------- | ---------------------------------------------------- | -------- | --------------------------------------------- |
| `RUN_ID`                    | Unique identifier for the test run                   | Yes      | Auto-generated                                |
| `WORKLOAD`                  | Path to the workload configuration YAML file         | Yes      | `./workloads/example-workload.yaml`           |
| `INSTANCE_ID`               | Instance identifier (auto-generated if not provided) | No       | Auto-generated                                |
| `ENABLE_OTEL`               | Enable OpenTelemetry metrics collection              | No       | `false`                                       |
| `METRICS_INTERVAL_MS`       | Metrics reporting interval in milliseconds           | No       | `1000`                                        |
| `METRICS_EXPORTER_ENDPOINT` | OTLP metrics exporter endpoint                       | No       | `http://host.docker.internal:4318/v1/metrics` |
| `APP_NAME`                  | Application name for metrics labeling                | No       | `node-redis-test`                             |
| `VERSION`                   | Application version for metrics labeling             | No       | `1.0.0`                                       |
| `LOG_LEVEL`                 | Logging level (info, error)                          | No       | `info`                                        |
| `NODE_ENV`                  | Node.js environment (development, production)        | No       | `production`                                  |

## Workload Configuration

Configuration is defined in YAML files. See `workloads/example-workload.yaml` for a complete example.

**Note:** Workload files should be placed in the `workloads/` directory as this folder is mounted as a volume to the Docker container, making the configuration files accessible during execution.

### Configuration Reference

| Configuration Path                                   | Required | Description                                    | Accepted Values                                 | Default Value |
| ---------------------------------------------------- | -------- | ---------------------------------------------- | ----------------------------------------------- | ------------- |
| **Redis Configuration**                              |          |                                                |                                                 |               |
| `runner.redis.host`                                  | Yes      | Redis server hostname                          | string                                          |               |
| `runner.redis.port`                                  | Yes      | Redis server port                              | number (1-65535)                                |               |
| `runner.redis.username`                              | No       | ACL username                                   | string                                          |               |
| `runner.redis.password`                              | No       | ACL password                                   | string                                          |               |
| `runner.redis.database`                              | No       | Redis database number                          | number (≥0)                                     |               |
| `runner.redis.timeout`                               | No       | Connection timeout                             | ISO 8601 duration                               |               |
| **Test Configuration**                               |          |                                                |                                                 |               |
| `runner.test.mode`                                   | Yes      | Test mode                                      | `standalone`, `cluster`                         |               |
| `runner.test.clients`                                | Yes      | Number of concurrent clients                   | number (≥1)                                     |               |
| `runner.test.workload.type`                          | Yes      | Workload type                                  | `get_set`, `redis_commands`, `multi`, `pub_sub` |               |
| `runner.test.workload.maxDuration`                   | Yes      | Maximum test duration                          | ISO 8601 duration, "endless"                    |               |
| **Workload Options**                                 |          |                                                |                                                 |               |
| `runner.test.workload.options.batchSize`             | Yes      | Number of operations per batch                 | number (≥1)                                     | `50`          |
| `runner.test.workload.options.getSetRatio`           | Yes      | Ratio of GET to SET operations                 | number (0.0-1.0)                                | `0.5`         |
| `runner.test.workload.options.valueSize`             | Yes      | Size of values in bytes                        | number (≥1)                                     | `100`         |
| `runner.test.workload.options.iterationCount`        | No       | Total number of iterations (optional)          | number (≥1) or null                             |               |
| `runner.test.workload.options.delayAfterIteration`   | No       | Delay between iterations                       | ISO 8601 duration                               |               |
| `runner.test.workload.options.elementsCount`         | Yes      | Number of elements for list operations         | number (≥1)                                     | `5`           |
| `runner.test.workload.options.transactionSize`       | Yes      | Number of commands per transaction             | number (≥1)                                     | `10`          |
| `runner.test.workload.options.keyGenerationStrategy` | Yes      | Key generation strategy                        | `random`, `sequential`                          | `random`      |
| `runner.test.workload.options.keyPattern`            | Yes      | Pattern for key generation (use %d for number) | string with %d placeholder                      | `key-%d`      |
| `runner.test.workload.options.keyRangeMin`           | Yes      | Minimum value for key range                    | number (≥0)                                     | `0`           |
| `runner.test.workload.options.keyRangeMax`           | Yes      | Maximum value for key range                    | number (≥1)                                     | `99999`       |
| **Client Options**                                   |          |                                                |                                                 |               |
| `runner.clientOptions.commandsQueueMaxLength`        | No       | Max command queue length                       | number (≥1)                                     |               |
| `runner.clientOptions.disableOfflineQueue`           | No       | Disable offline queuing                        | boolean                                         |               |
| `runner.clientOptions.readonly`                      | No       | Readonly mode                                  | boolean                                         |               |
| `runner.clientOptions.name`                          | No       | Client name                                    | string                                          |               |
| `runner.clientOptions.disableClientInfo`             | No       | Disable client info                            | boolean                                         |               |
| `runner.clientOptions.clientInfoTag`                 | No       | Tag to append to library name                  | string                                          |               |
| `runner.clientOptions.pingInterval`                  | No       | Send `PING` command at interval                | ISO 8601 duration                               |               |
| **Client Socket Options**                            |          |                                                |                                                 |               |
| `runner.clientOptions.socket.noDelay`                | No       | Toggle Nagle's algorithm                       | boolean                                         |               |
| `runner.clientOptions.socket.keepAlive`              | No       | Toggle keep-alive functionality                | boolean                                         |               |
| `runner.clientOptions.socket.keepAliveInitialDelay`  | No       | Keep-alive initial delay                       | ISO 8601 duration                               |               |
| `runner.clientOptions.socket.tls`                    | No       | Enable TLS/SSL                                 | boolean                                         |               |
| `runner.clientOptions.socket.rejectUnauthorized`     | No       | Verify server certificate                      | boolean                                         |               |
| `runner.clientOptions.socket.socketTimeout`          | No       | Socket timeout                                 | ISO 8601 duration                               |               |
| `runner.clientOptions.socket.ca`                     | No       | Certificate Authority file path                | string (file path)                              |               |
| `runner.clientOptions.socket.cert`                   | No       | Client certificate file path                   | string (file path)                              |               |
| `runner.clientOptions.socket.key`                    | No       | Client private key file path                   | string (file path)                              |               |
| `runner.clientOptions.socket.passphrase`             | No       | Private key passphrase                         | string                                          |               |
| **Cluster Specific Configuration**                   |          |                                                |                                                 |               |
| `runner.clusterClientOptions.minimizeConnections`    | No       | Minimize connections                           | boolean                                         |               |
| `runner.clusterClientOptions.useReplicas`            | No       | Use replica nodes for reads                    | boolean                                         |               |
| `runner.clusterClientOptions.maxCommandRedirections` | No       | Max command redirections                       | number (≥1)                                     |               |

## 📈 Metrics Collection

### Local Metrics Visualization

To view metrics locally, clone and set up the observability stack:

```sh
git clone https://github.com/redis-developer/observability-stack
cd observability-stack
# Follow the setup instructions in the repository
```

Once the observability stack is running, you can collect metrics by setting the `METRICS_EXPORTER_ENDPOINT` environment variable:
- For local development: `http://localhost:4318/v1/metrics`
- When running both this app and observability stack in Docker: `http://host.docker.internal:4318/v1/metrics`
- Alternatively, configure both to use the same Docker network and use the service name as hostname

### Standardized Metrics

All Redis testing applications send these standardized metrics:

| Metric                           | Type      | Description                           |
| -------------------------------- | --------- | ------------------------------------- |
| `redis_operations_total`         | Counter   | Total Redis operations executed       |
| `redis_operation_duration`       | Histogram | Operation latency in milliseconds     |
| `redis_connections_total`        | Counter   | Connection attempts (success/failure) |
| `redis_reconnection_duration_ms` | Histogram | Reconnection time                     |

### Labels

All metrics include these labels for filtering and grouping:

| Label         | Description                | Example Values                        |
| ------------- | -------------------------- | ------------------------------------- |
| `app_name`    | Application name           | `node-redis-test`                     |
| `instance_id` | Unique instance identifier | `abc123def456`                        |
| `version`     | Application version        | `1.0.0`                               |
| `run_id`      | Test run identifier        | `performance-test-2024`               |
| `operation`   | Redis command name         | `GET`, `SET`, `LPUSH`                 |
| `status`      | Operation result           | `success`, `error`                    |
| `error_type`  | Error classification       | `timeout`, `connection_error`, `none` |
