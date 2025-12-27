# Production Line Planning System

An autonomous production line planning system built with Mastra.ai, Supabase, and Gemini 3 Pro.

## Features

- **Autonomous Workflow Management**: Uses Mastra.ai workflows for autonomous project lifecycle management
- **Multi-Phase Planning**:
  - **Data Collection**: AI chats with user to gather production line requirements
  - **Process Creation**: Creates Industry 5.0 compliant production plans
  - **Machine Research**: Searches for machines and suppliers using Google Search Grounding
  - **Machine Generation**: Generates images and 3D models for each machine
- **Real-time Updates**: Supabase Realtime for live project monitoring
- **TypeScript**: Fully typed codebase (backend & frontend)

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **AI Framework**: Mastra.ai (https://mastra.ai/)
- **Database**: Supabase (PostgreSQL)
- **AI Model**: Google Gemini 3 Pro
- **Storage**: Supabase Storage (for files, images, 3D models)
- **Real-time**: Supabase Realtime

## Setup

### Prerequisites

- Node.js v20+
- Supabase account and project
- Gemini API key

### Backend Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Set up environment variables**:
Create a `.env` file in the root directory:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Server Configuration
PORT=3001
NODE_ENV=development
```

3. **Database Schema**:
The database schema has already been created via Supabase migrations. It includes:
- `projects` table
- `machines` table
- `chat_messages` table

4. **Run the server**:
```bash
npm run dev
```

The backend server will start on `http://localhost:3001`

### Frontend Setup

1. **Navigate to client directory**:
```bash
cd client
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
Create a `.env` file in the `client` directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

4. **Run the frontend**:
```bash
npm run dev
```

The frontend will start on `http://localhost:3000`

## Project Status Flow

1. **DATA_COLLECTING**: AI collects information from user via chat
2. **CREATING_PROCCES**: AI creates production line plan
3. **MACHINES_REASERCH**: AI researches machines and suppliers
4. **MACHINES_GENERATED**: All machines have images and 3D models generated

## API Endpoints

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create new project

### Chat
- `POST /api/chat/:projectId` - Send message to project chat
- `GET /api/chat/:projectId/history` - Get conversation history

### Machines
- `GET /api/machines/project/:projectId` - Get machines for a project
- `PATCH /api/machines/:id/status` - Update machine status
- `POST /api/machines/:id/retry` - Retry machine generation

## Development

### Backend
```bash
npm run dev        # Start development server with hot reload
npm run build      # Build TypeScript
npm start          # Run production build
```

### Frontend
```bash
cd client
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

## Project Structure

```
.
├── server/           # Backend (TypeScript)
│   ├── config/       # Configuration (Supabase, Gemini)
│   ├── services/     # Business logic services
│   ├── workflows/    # Mastra workflows
│   ├── routes/       # Express routes
│   ├── types/        # TypeScript types
│   └── index.ts      # Server entry point
├── client/           # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── lib/         # API client, Supabase client
│   │   ├── types/       # TypeScript types
│   │   └── App.tsx      # Main app component
│   └── vite.config.ts   # Vite configuration
└── README.md
```

## Features Implementation

- ✅ Supabase database schema with all tables
- ✅ Backend API with TypeScript
- ✅ Mastra workflow for autonomous project management
- ✅ Gemini 3 Pro integration with Google Search Grounding
- ✅ React frontend with TypeScript
- ✅ Supabase Realtime for live updates
- ✅ Machine generation workflow (image + 3D model)
- ⏳ Image generation (currently placeholder)
- ⏳ Meshy3D integration (currently 3s delay bypass)
- ⏳ File upload support

## References

- [Mastra.ai Documentation](https://mastra.ai/)
- [Mastra Workflows](https://mastra.ai/docs/workflows)
- [Google Gemini API](https://ai.google.dev/)
- [Supabase Documentation](https://supabase.com/docs)

