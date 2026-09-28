insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jmp-catalog', 'jmp-catalog', true, 52428800, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can list JMP catalog PDFs" on storage.objects;
create policy "Public can list JMP catalog PDFs"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'jmp-catalog');

drop policy if exists "JMP administrator can upload catalog PDFs" on storage.objects;
create policy "JMP administrator can upload catalog PDFs"
on storage.objects
for insert
to authenticated
with check (
	bucket_id = 'jmp-catalog'
	and lower(coalesce((select auth.jwt() ->> 'email'), '')) = any (array[
		'jmpcomercioerepresentacao@yahoo.com.br',
		'victorperciodeoliveira@gmail.com'
	])
);

drop policy if exists "JMP administrator can delete catalog PDFs" on storage.objects;
create policy "JMP administrator can delete catalog PDFs"
on storage.objects
for delete
to authenticated
using (
	bucket_id = 'jmp-catalog'
	and lower(coalesce((select auth.jwt() ->> 'email'), '')) = any (array[
		'jmpcomercioerepresentacao@yahoo.com.br',
		'victorperciodeoliveira@gmail.com'
	])
);