grant delete on public.sticky_notes to authenticated;

drop policy if exists "Users can delete their own notes" on public.sticky_notes;
create policy "Users can delete their own notes"
  on public.sticky_notes for delete
  to authenticated
  using ((select auth.uid()) = user_id);
