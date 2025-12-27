# Setup Instructions

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=AIzaSyDoflplqtb52hrNrFB3OWZ7JRxdshCdGbo
```

Start the backend:
```bash
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install --legacy-peer-deps
```

Create `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:3000/api
```

Start the frontend:
```bash
npm run dev
```

### 3. Database

The database schema has already been created via Supabase migration. The tables include:
- `projects` - with `current_step`, `planning_data`, `cost_analysis_pdf`
- `project_messages` - chat messages
- `project_files` - uploaded files
- `assets` - production assets/machines
- `suppliers` - supplier information
- And other supporting tables

## Features Implemented

✅ ChatGPT-style interface with file uploads
✅ Step-based workflow (12 steps from chat to completed)
✅ Vertical stepper with progress indication
✅ Retry functionality for failed steps
✅ AI-powered planning using Google Gemini
✅ 2D layout generation (placeholder)
✅ Asset image generation (placeholder)
✅ Supplier sourcing (placeholder)
✅ Cost analysis with PDF generation
✅ Database-driven state persistence

## AI Integration

The system uses **Google Gemini** (Gemini Pro) for:
- Chat interactions (lightweight)
- Planning and analysis (complex reasoning)
- Cost analysis and financial projections

The Gemini API key is already configured in the code.

## Next Steps for Production

1. Replace placeholder image generation with actual service (Meshy3D or DALL-E)
2. Implement real Google Search API integration for supplier sourcing
3. Add 3D model generation step (currently skipped)
4. Implement phone API integration for negotiations
5. Enhance 2D layout generation with actual CAD/BIM libraries
6. Add file upload to Supabase Storage
