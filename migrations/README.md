# Database Migrations

## Update Project Status Constraint

The database check constraint needs to be updated to include the new status values.

### How to Run

1. **Open Supabase Dashboard**: Go to your Supabase project dashboard
2. **Navigate to SQL Editor**: Click on "SQL Editor" in the left sidebar
3. **Run the Migration**: Copy and paste the contents of `update_project_status_constraint.sql` into the SQL editor
4. **Execute**: Click "Run" to execute the migration

### What This Does

- Drops the old `projects_status_check` constraint
- Creates a new constraint that allows all 6 status values:
  - `DATA_COLLECTING`
  - `CREATING_PROCCES`
  - `ASSETS_RESEARCH` (new)
  - `GENERATING_2D_LAYOUT` (new)
  - `GENERATING_3D_MODEL` (new)
  - `PROJECT_COMPLETED` (new)

### Alternative: Using Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db execute -f migrations/update_project_status_constraint.sql
```

