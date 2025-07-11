#!/bin/bash

# Default values
DEFAULT_WORKLOAD="./workloads/example-workload.yaml"
DEFAULT_REPLICAS=1
DEFAULT_LOG_LEVEL="info"
RUN_ID=${RUN_ID:-$(date +%s)-$(openssl rand -hex 4)}
NODE_ENV=${NODE_ENV:-"production"}
LOG_LEVEL=${LOG_LEVEL:-$DEFAULT_LOG_LEVEL}
METRICS_INTERVAL_MS=${METRICS_INTERVAL_MS:-1000}
METRICS_EXPORTER_ENDPOINT=${METRICS_EXPORTER_ENDPOINT:-"http://host.docker.internal:4318/v1/metrics"}

# Function to display usage
usage() {
    echo "Usage: $0 {build|dev|start} [options]"
    echo "Commands:"
    echo "  build: Build Docker image"
    echo "    Options:"
    echo "      --dev    Build development image"
    echo "      --prod   Build production image (default)"
    echo "  dev: Run in development mode with hot reload"
    echo "  start: Run in production mode"
    echo ""
    echo "Common Options:"
    echo "  -w, WORKLOAD  Specify workload file (default: $DEFAULT_WORKLOAD)"
    echo "  -r, REPLICAS  Specify number of replicas (default: $DEFAULT_REPLICAS)"
    echo "  -l, LEVEL     Specify log level (default: $DEFAULT_LOG_LEVEL)"
    echo "                                      Valid values: info, error"
    echo "  -h,           Display this help message"
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
BUILD_TYPE="prod" # Default build type

# Parse options using getopts
while getopts "w:r:l:h-:" opt; do
    case $opt in
    w)
        WORKLOAD="$OPTARG"
        ;;
    r)
        REPLICAS="$OPTARG"
        ;;
    l)
        LOG_LEVEL="$OPTARG"
        # Validate log level
        if [[ "$LOG_LEVEL" != "info" && "$LOG_LEVEL" != "error" ]]; then
            echo "Error: Invalid log level. Valid values are 'info' or 'error'."
            exit 1
        fi
        ;;
    h)
        usage
        ;;
    -)
        case "${OPTARG}" in
        dev)
            BUILD_TYPE="dev"
            ;;
        prod)
            BUILD_TYPE="prod"
            ;;
        help)
            usage
            ;;
        *)
            echo "Invalid option: --${OPTARG}"
            usage
            ;;
        esac
        ;;
    \?)
        echo "Invalid option: -$OPTARG"
        usage
        ;;
    :)
        echo "Option -$OPTARG requires an argument"
        usage
        ;;
    esac
done

# Shift to get remaining arguments
shift $((OPTIND - 1))

# Common environment variables
DOCKER_ENV="WORKLOAD=$WORKLOAD REPLICAS=$REPLICAS RUN_ID=$RUN_ID LOG_LEVEL=$LOG_LEVEL METRICS_INTERVAL_MS=$METRICS_INTERVAL_MS METRICS_EXPORTER_ENDPOINT=$METRICS_EXPORTER_ENDPOINT"
DEV_ENV="NODE_ENV=development APP_SERVICE=app-dev"
PROD_ENV="NODE_ENV=production APP_SERVICE=app"

build() {
    if [ "$BUILD_TYPE" = "dev" ]; then
        echo "Building development image..."
        eval "$DOCKER_ENV $DEV_ENV docker compose --profile dev build --no-cache"
    else
        echo "Building production image..."
        eval "$DOCKER_ENV $PROD_ENV docker compose --profile prod build --no-cache"
    fi
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
build)
    build
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
