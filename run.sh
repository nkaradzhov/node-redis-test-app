#!/bin/bash

# Default values
DEFAULT_WORKLOAD="./workloads/example-workload.yaml"
DEFAULT_REPLICAS=1
DEFAULT_LOG_LEVEL="info"
RUN_ID=${RUN_ID:-$(date +%s)-$(openssl rand -hex 4)}
NODE_ENV=${NODE_ENV:-"production"}
LOG_LEVEL=${LOG_LEVEL:-$DEFAULT_LOG_LEVEL}
METRICS_INTERVAL_MS=${METRICS_INTERVAL_MS:-1000}

# Function to display usage
usage() {
    echo "Usage: $0 {build|dev|start} [options]"
    echo "Commands:"
    echo "  build_dev: Build the dev Docker image"
    echo "  build_prod: Build the prod Docker image"
    echo "  dev: Run in development mode with hot reload"
    echo "  start: Run in production mode"
    echo ""
    echo "Options:"
    echo "  -w, --workload WORKLOAD  Specify workload file (default: $DEFAULT_WORKLOAD)"
    echo "  -r, --replicas REPLICAS  Specify number of replicas (default: $DEFAULT_REPLICAS)"
    echo "  -l, --log-level LEVEL    Specify log level (default: $DEFAULT_LOG_LEVEL)"
    echo "                           Valid values: info, error"
    echo "  -h, --help               Display this help message"
    exit 1
}

# Parse command
if [ $# -lt 1 ]; then
    usage
fi

COMMAND=$1
shift

# Parse options
WORKLOAD=$DEFAULT_WORKLOAD
REPLICAS=$DEFAULT_REPLICAS
LOG_LEVEL=$DEFAULT_LOG_LEVEL

# Use getopt to parse options
TEMP=$(getopt -o w:r:l:h --long workload:,replicas:,log-level:,help -n "$0" -- "$@")

# Check if getopt succeeded
if [ $? != 0 ]; then
    echo "Error parsing options" >&2
    usage
fi

# Set the parsed options back to the positional parameters
eval set -- "$TEMP"

# Process the options
while true; do
    case "$1" in
    -w | --workload)
        WORKLOAD="$2"
        shift 2
        ;;
    -r | --replicas)
        REPLICAS="$2"
        shift 2
        ;;
    -l | --log-level)
        LOG_LEVEL="$2"
        # Validate log level
        if [[ "$LOG_LEVEL" != "info" && "$LOG_LEVEL" != "error" ]]; then
            echo "Error: Invalid log level. Valid values are 'info' or 'error'."
            exit 1
        fi
        shift 2
        ;;
    -h | --help)
        usage
        ;;
    --)
        shift
        break
        ;;
    *)
        echo "Internal error!" >&2
        exit 1
        ;;
    esac
done

# Common environment variables
DOCKER_ENV="WORKLOAD=$WORKLOAD REPLICAS=$REPLICAS RUN_ID=$RUN_ID LOG_LEVEL=$LOG_LEVEL METRICS_INTERVAL_MS=$METRICS_INTERVAL_MS"
DEV_ENV="NODE_ENV=development APP_SERVICE=app-dev"
PROD_ENV="NODE_ENV=production APP_SERVICE=app"

build_dev() {
    eval "$DOCKER_ENV $DEV_ENV docker compose --profile dev build --no-cache"
}

build_prod() {
    eval "$DOCKER_ENV $PROD_ENV docker compose --profile prod build --no-cache"
}

# Function to handle dev command
dev() {
    eval "$DOCKER_ENV $DEV_ENV DOCKER_COMMAND=\"npm run dev\" docker compose --profile dev up"
}

# Function to handle start command
start() {
    eval "$DOCKER_ENV $PROD_ENV docker compose --profile prod up"
}

# Command processing
case "$COMMAND" in
build_dev)
    build_dev
    ;;
build_prod)
    build_prod
    ;;
dev)
    dev
    ;;
start)
    start
    ;;
*)
    echo "Unknown command: $COMMAND"
    usage
    ;;
esac

exit 0
