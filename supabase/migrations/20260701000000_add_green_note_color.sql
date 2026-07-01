alter table public.sticky_notes
  drop constraint if exists sticky_notes_color_check;

alter table public.sticky_notes
  add constraint sticky_notes_color_check
  check (color in ('red', 'yellow', 'blue', 'green'));
