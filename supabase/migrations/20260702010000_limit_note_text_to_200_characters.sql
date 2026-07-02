alter table public.sticky_notes
  drop constraint if exists sticky_notes_text_check;

alter table public.sticky_notes
  add constraint sticky_notes_text_check
  check (char_length(text) <= 200) not valid;
