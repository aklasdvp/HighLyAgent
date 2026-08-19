# Deployment Guide

1. Provision a VPS/DigitalOcean host with Docker and Compose.
2. Clone this repository; create a production `.env` outside version control and set a strong JWT secret, database password, allowed frontend origins, and only required provider keys.
3. Start `docker compose up -d --build`.
4. Put Nginx in front of port 8000 and proxy both HTTP and WebSocket upgrade traffic for `/ws`.
5. Obtain TLS certificates with Certbot/Let's Encrypt and redirect HTTP to HTTPS.
6. Docker restart policies provide process auto-restart; use a systemd unit only if Docker itself is not enabled at boot.

Never expose PostgreSQL or Redis publicly.