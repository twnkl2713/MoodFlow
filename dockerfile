# Build Stage
FROM rust:1.70 as builder

WORKDIR /usr/src/app
COPY . .

RUN cargo build --release

# Runtime Stage
FROM debian:buster-slim
WORKDIR /app

# Copy the compiled binary
COPY --from=builder /usr/src/app/target/release/YOUR_BINARY_NAME /app/server

# Copy your static files (if server reads from them)
COPY static ./static
COPY data ./data

EXPOSE 3000
CMD ["./server"]
