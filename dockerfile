# Use the official Rust image to build and run the application
FROM rust:1.76 as builder

# Set the working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY static ./static
COPY data ./data

# Build the app
RUN cargo build --release

# Prepare minimal image
FROM debian:buster-slim

# Set working directory
WORKDIR /app

# Copy built binary
COPY --from=builder /app/target/release/moodflow /app/moodflow

# Copy static files and data
COPY static ./static
COPY data ./data

# Expose port
EXPOSE 3000

# Run binary
CMD ["./moodflow"]
