# SocialPulse

A full-stack social media management SaaS platform — schedule posts, generate AI content, and track analytics across Twitter/X, Instagram, LinkedIn, and Facebook.

**Stack:** React 19 + TypeScript + Tailwind CSS v4 · Node.js + Express · PostgreSQL + Redis · OpenAI GPT-4 · Bull.js

---

## Getting Started

### Prerequisites
- Node.js v22+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

### Clone and install

```bash
git clone https://github.com/your-org/social-pulse
cd social-pulse

# Install backend dependencies
cd socialPulse-app/backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Environment setup

```bash
cp socialPulse-app/backend/.env.example socialPulse-app/backend/.env
cp socialPulse-app/frontend/.env.example socialPulse-app/frontend/.env
```

Fill in your credentials in both `.env` files (database, Redis, JWT secret, API keys).

### Start with Docker

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, the backend (port 5000), and the frontend (port 3000).

### Or run manually

```bash
# Terminal 1 — backend
cd socialPulse-app/backend
npm run dev

# Terminal 2 — frontend
cd socialPulse-app/frontend
npm run dev
```

### Database migration

```bash
cd socialPulse-app/backend
npm run migrate
```

### Open in browser

```
http://localhost:3000
```

---

## Project Structure

```
socialPulse-1/
├── docker-compose.yml
├── socialPulse-app/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/        # DB, Redis, env, plans
│   │   │   ├── controllers/   # auth, posts, ai, social
│   │   │   ├── jobs/          # Bull queues (post publisher, analytics sync)
│   │   │   ├── middleware/    # auth, error handler
│   │   │   ├── routes/        # Express routers
│   │   │   ├── services/      # AI, Twitter, Instagram, LinkedIn, Facebook
│   │   │   └── server.ts
│   │   └── Dockerfile
│   └── frontend/
│       ├── src/
│       │   ├── pages/         # Dashboard, ContentStudio, Scheduler, Analytics, Settings
│       │   ├── components/    # AppLayout, PrivateRoute, common
│       │   ├── store/         # Redux slices (auth, posts)
│       │   └── services/      # Axios API client
│       └── Dockerfile
```


## Usage

To run the application, use the following command:
```
npm start
```

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bugs.

## License

This project is licensed under the MIT License. See the LICENSE file for details.