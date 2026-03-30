# Chip Sim Backend Makefile

.PHONY: all build test run clean

all: test build

build:
	@echo "Building chip-sim-server..."
	go build -o bin/chip-sim-server ./cmd/server

test:
	@echo "Running tests..."
	go test ./... -v -race

run: build
	@echo "Starting server..."
	./bin/chip-sim-server

clean:
	rm -rf bin/

lint:
	go vet ./...
	staticcheck ./... 2>/dev/null || true

fmt:
	gofmt -w .
	goimports -w . 2>/dev/null || true
