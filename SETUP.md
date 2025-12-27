# Setup & Run Guide

## Quick Start

### 1. Install Dependencies

**Backend:**
```bash
npm install
```

**Frontend:**
```bash
cd client
npm install
cd ..
```

### 2. Environment Variables

**Backend `.env` (root directory):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
NODE_ENV=development
```

**Frontend `.env` (client directory):**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Run Development Servers

**Terminal 1 - Backend:**
```bash
npm run dev
```
Server runs on: http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```
Frontend runs on: http://localhost:3000

### 4. Verify Setup

1. Backend health check: http://localhost:3001/health
2. Frontend: http://localhost:3000
3. Create a new project and start chatting!

## Troubleshooting

### Mastra Package Issues
If you get errors about `@mastra/core`, try:
```bash
npm install @mastra/core@latest
```

### TypeScript Errors
If you see TypeScript errors, ensure:
- All dependencies are installed
- `.env` files are properly configured
- Supabase project is active and accessible

### Database Connection
Ensure your Supabase project is active and the database tables exist (they were created via migration).

## Testing

Currently, basic manual testing:
1. Create a project
2. Send messages in the chat
3. Watch the project status change automatically
4. Check machines being generated in real-time

