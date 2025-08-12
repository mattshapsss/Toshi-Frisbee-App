# Ultimate D-Line Manager - Project Vision

## Core Purpose
Enable multiple coaches/captains to collaboratively manage defensive matchups in real-time during Ultimate Frisbee games.

## Key Principles
- **Team-based data**: All defenders, games, and stats belong to teams, not individuals
- **Real-time sync**: Multiple users see live updates instantly via WebSockets
- **Simple auth**: Email/password with 6-character team invite codes
- **Original UX preserved**: Exact same drag-and-drop interface, Tufts Blue (#3E8EDE)

## Development Rules
1. **Always READ before EDIT** - Use `Read` tool first, understand existing code
2. **Never duplicate** - Search for existing implementations with `Grep`/`Glob`
3. **Test continuously** - Run code after each change
4. **Use ultrathink** - Complex problems need deep consideration
5. **Preserve working code** - Don't break what works

## Testing Commands
```bash
# Backend (with virtual env)
cd backend
python3 -m venv venv
source venv/bin/activate
nohup npm run dev > backend.log 2>&1 &

# Frontend
cd frontend
nohup npm run dev > frontend.log 2>&1 &
```

## Tech Stack
- Backend: Node.js, Express, Prisma, PostgreSQL, Redis, Socket.io
- Frontend: React, TypeScript, TailwindCSS, Zustand, React Query
- Auth: JWT with team-based permissions