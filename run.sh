#!/bin/bash

# Default values
DEFAULT_WORKLOAD="./workloads/example-workload.yaml"
DEFAULT_REPLICAS=1
DEFAULT_LOG_LEVEL="info"
RUN_ID=${RUN_ID:-$(date +%s)-$(openssl rand -hex 4)}
NODE_ENV=${NODE_ENV:-"production"}
LOG_LEVEL=${LOG_LEVEL:-$DEFAULT_LOG_LEVEL}
METRICS_INTERVAL_MS=${METRICS_INTERVAL_MS:-1000}
METRICS_EXPORTER_ENDPOINT=${METRICS_EXPORTER_ENDPOINT}
ENABLE_OTEL=${ENABLE_OTEL}
APP_NAME=${APP_NAME-"node-redis-test"}
VERSION=${VERSION-"1.0.0"}
REPO_URL=${REPO_URL:-"https://github.com/nkaradzhov/node-redis.git"}
REPO_BRANCH=${REPO_BRANCH:-"hitless-upgrades"}

# Function to display usage
usage() {
    echo "Usage: $0 {build|dev|start|local} [options]"
    echo "Commands:"
    echo "  build: Build Docker image"
    echo "    Options:"
    echo "      --dev    Build development image"
    echo "      --prod   Build production image (default)"
    echo "  dev: Run in development mode with hot reload (Docker)"
    echo "  start: Run in production mode (Docker)"
    echo "  local: Run locally without Docker"
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
RUN_ENV="WORKLOAD=$WORKLOAD REPLICAS=$REPLICAS RUN_ID=$RUN_ID LOG_LEVEL=$LOG_LEVEL LOG_PRETTY=$LOG_PRETTY METRICS_INTERVAL_MS=$METRICS_INTERVAL_MS METRICS_EXPORTER_ENDPOINT=$METRICS_EXPORTER_ENDPOINT ENABLE_OTEL=$ENABLE_OTEL APP_NAME=$APP_NAME VERSION=$VERSION"
BUILD_ENV="REPO_URL=$REPO_URL REPO_BRANCH=$REPO_BRANCH"
DEV_ENV="NODE_ENV=development APP_SERVICE=app-dev"
PROD_ENV="NODE_ENV=production APP_SERVICE=app"

build() {
    if [ "$BUILD_TYPE" = "dev" ]; then
        echo "Building development image..."
        eval "$RUN_ENV $DEV_ENV $BUILD_ENV docker compose --profile dev build --no-cache"
    else
        echo "Building production image..."
        eval "$RUN_ENV $PROD_ENV $BUILD_ENV docker compose --profile prod build --no-cache"
    fi
}

# Function to handle dev command
dev() {
    # Set DOCKER_COMMAND conditionally based on ENABLE_OTEL
    if [ "$ENABLE_OTEL" = "true" ]; then
        DOCKER_COMMAND="npm run dev:otel"
    else
        DOCKER_COMMAND="npm run dev"
    fi

    eval "$RUN_ENV $DEV_ENV DOCKER_COMMAND=\"$DOCKER_COMMAND\" docker compose --profile dev up"

    echo -e "\033[1;93m CHECK LOGS AT: $(pwd)/out/$RUN_ID \033[0m"
}

# Function to handle start command
start() {
    eval "$RUN_ENV $PROD_ENV docker compose --profile prod up"
    echo -e "\033[1;93m CHECK LOGS AT: $(pwd)/out/$RUN_ID/*/app.log \033[0m"
}

# Function to handle local command
local() {
    # Set LOG_PRETTY=true by default for local development unless explicitly set
    if [ -z "$LOG_PRETTY" ]; then
        LOG_PRETTY=true
    fi
    
    # Run with or without OpenTelemetry
    if [ "$ENABLE_OTEL" = "true" ]; then
        eval "LOG_PRETTY=$LOG_PRETTY $RUN_ENV $DEV_ENV npm run dev:otel"
    else
        eval "LOG_PRETTY=$LOG_PRETTY $RUN_ENV $DEV_ENV npm run dev"
    fi
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
local)
    local
    ;;
*)
    echo "Unknown command: $COMMAND"
    usage
    ;;
esac

exit 0
