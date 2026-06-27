# Supabase Database Connection Setup

## Current Issue
The database connection is failing because:
1. The DATABASE_URL in `.env` file has no password (empty between `postgres:` and `@`)
2. SSL mode needs to be set to `require` for Supabase connections

## Fix Instructions

### Step 1: Update .env file
Edit the `backend/.env` file and set your Supabase password:

```bash
# Current (incorrect):
DATABASE_URL=postgresql://postgres:@db.wehiuatghfiapncvuztj.supabase.co:5432/postgres

# Correct (replace YOUR_PASSWORD with your actual Supabase password):
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.wehiuatghfiapncvuztj.supabase.co:5432/postgres?sslmode=require
```

### Step 2: Get your Supabase Password
1. Go to https://supabase.com
2. Select your project `gitrepoA` (db.wehiuatghfiapncvuztj.supabase.co)
3. Navigate to Settings → Database
4. Under "Database Password", you'll find or can reset your password
5. Alternatively, check your Supabase dashboard connection string

### Step 3: Connection String Format
For Supabase, your connection string should be:
```
postgresql://postgres:<YOUR_PASSWORD>@<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require
```

Where:
- `postgres` is the username (default)
- `<YOUR_PASSWORD>` is your database password
- `<PROJECT_REF>` is your project reference (e.g., `db.wehiuatghfiapncvuztj`)
- `postgres` is the database name
- `sslmode=require` enforces SSL (required by Supabase)

### Step 4: Test the Connection
```bash
cd /home/sam/Music/gitrepoA/backend
go run .
```

## Alternative: Local PostgreSQL
If you prefer to use a local PostgreSQL database instead:

1. Install PostgreSQL locally
2. Create a database:
   ```bash
   createdb vaultke
   ```
3. Update `.env`:
   ```bash
   DATABASE_URL=postgres://postgres:password@localhost/vaultke?sslmode=disable
   ```

## Troubleshooting

### "password authentication failed for user 'postgres'"
- Verify your Supabase password is correct
- Check for extra spaces in the DATABASE_URL
- Go to Supabase → Settings → Database → Reset password if needed

### "no pg_hba.conf entry for host"
- Make sure you're using the full Supabase connection string
- Ensure `sslmode=require` is set for Supabase connections

### Running migrations
If the connection works but tables don't exist:
```bash
go run .  # Migrations run automatically on startup
```
