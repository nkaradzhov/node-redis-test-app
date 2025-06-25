.PHONY: build dev start

WORKLOAD ?= ./workloads/example-workload.yaml
REPLICAS ?= 1
RUN_ID ?= $(shell date +%s)-$(shell openssl rand -hex 4)
NODE_ENV ?= production
LOG_LEVEL ?= info
METRICS_INTERVAL_MS ?= 1000

DOCKER_ENV := WORKLOAD=$(WORKLOAD) REPLICAS=$(REPLICAS) RUN_ID=$(RUN_ID) LOG_LEVEL=$(LOG_LEVEL) METRICS_INTERVAL_MS=$(METRICS_INTERVAL_MS)

build:
	docker compose build --no-cache

dev:
	$(DOCKER_ENV) NODE_ENV=development BUILD_TARGET=builder DOCKER_COMMAND="npm run dev" docker compose --profile dev up

start:
	$(DOCKER_ENV) BUILD_TARGET=production docker compose up
