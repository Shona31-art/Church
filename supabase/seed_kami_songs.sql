-- ============================================================================
-- Kingdom Awakening Ministries: starter song list (one-off, optional)
-- ============================================================================
-- Adds the church's EasyWorship songs (titles only — add lyrics in the app
-- with Edit). Finds the church by name. Songs already in the list are
-- skipped, so it's safe to run more than once. Needs songs.sql (#36) first.
-- ============================================================================
insert into songs (church_id, title)
select c.id, t.title
from churches c
cross join (values
  ('Goodness of God'),
  ('I''ll Raise a Hallelujah'),
  ('Way Maker'),
  ('Yahweh'),
  ('Yeshua'),
  ('I Sing Praises'),
  ('Holy Forever'),
  ('Trust in God'),
  ('Nothing Without You'),
  ('Lord I''m Amazed by You'),
  ('Worthy Is Your Name')
) as t(title)
where c.name ilike 'Kingdom Awakening%'
on conflict do nothing;

-- Shows what was added: the church, and how many songs it now has.
select c.name as church, count(s.id) as songs_in_list
from churches c left join songs s on s.church_id = c.id
where c.name ilike 'Kingdom Awakening%'
group by c.name;
