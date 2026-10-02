import { readFileSync } from 'node:fs';
const status = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const mapping = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY || status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
};
for (const [name, value] of Object.entries(mapping)) {
  if (!value) throw new Error('Missing local service configuration: ' + name);
  process.stdout.write(name + '=' + value + '\n');
}
