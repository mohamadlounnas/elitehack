# Factory Planning Application

A step-based factory planning system built with TypeScript, React, and Node.js.

## Architecture

- **Frontend**: Vite + React + TypeScript + @medusajs/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: LangChain with Google Gemini (Gemini Pro & Nano)

## Setup

### Frontend

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Create a `.env` file with:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:3000/api
```

4. Run the development server:
```bash
npm run dev
```

### Backend

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with:
```
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

4. Run the development server:
```bash
npm run dev
```

## Project Structure

### Frontend
- `src/components/` - React components (ChatInterface, StepProgress)
- `src/pages/` - Page components (ProjectPage, ProjectsList)
- `src/services/` - API client and Supabase client
- `src/types/` - TypeScript type definitions

### Backend
- `src/routes/` - Express route handlers
- `src/services/` - Business logic (AI services, orchestration)
- `src/utils/` - Utility functions (Supabase, LangChain setup)

## Workflow Steps

1. **chat** - Initial chat phase for gathering requirements
2. **planning** - AI analyzes requirements and creates plan
3. **planed** - Planning complete, results shown
4. **assetsImagesGenerating** - Generating images for assets
5. **assetsImagesGenerated** - All asset images complete
6. **sourcing** - Searching for suppliers
7. **sourced** - Sourcing complete
8. **negotiating** - Negotiation phase (bypassed for now)
9. **negotiated** - Negotiation complete
10. **cost_analysing** - TCO calculations and business plan generation
11. **cost_analysed** - Cost analysis complete
12. **completed** - Final state

## API Endpoints

- `POST /api/projects` - Create a new project
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects/:id/chat` - Send chat message
- `GET /api/projects/:id/messages` - Get chat messages
- `POST /api/projects/:id/start-planning` - Start planning workflow
- `POST /api/projects/:id/retry-step` - Retry current step
- `GET /api/projects/:id/assets` - Get project assets
- `GET /api/projects/:id/status` - Get project status

## Database Schema

The database uses Supabase (PostgreSQL) with the following main tables:
- `projects` - Project information and current step
- `project_messages` - Chat messages
- `project_files` - Uploaded files
- `assets` - Production assets/machines
- `suppliers` - Supplier information
- `tco_calculations` - Cost calculations

## Notes

- The system uses step-based workflow orchestration
- AI integration via LangChain and OpenAI
- File uploads supported (PDF, TXT, images)
- Real-time progress tracking via polling
- Step persistence allows resuming from any point
