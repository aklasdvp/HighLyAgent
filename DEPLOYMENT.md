# Deployment

Deploy the backend stack to a VPS/DigitalOcean host with Docker Engine and Compose installed.

1. Clone the backend repository and create `backend/.env` from the example; keep it outside source control.
2. Set a long random `JWT_SECRET_KEY`, database password, production `ALLOWED_ORIGINS`, and only the provider keys you use.
3. Start with `docker compose up -d --build`; inspect `docker compose ps` and `docker compose logs -f api`.
4. Put a TLS reverse proxy (for example Nginx or Caddy) in front of port 8000. Terminate HTTPS there and forward WebSocket upgrade headers for `/ws`.
5. Keep PostgreSQL and Redis ports firewalled/private in production; expose only the reverse proxy.

The frontend is intentionally a separate repository and is not deployed by this Compose file.
