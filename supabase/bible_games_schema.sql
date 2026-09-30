-- ============================================================================
-- BIBLE GAMES — quiz + scoreboard
-- New module key 'bible_games', available on every plan (same reasoning as
-- 'support': a fun daily-engagement feature shouldn't be paywalled away
-- from smaller churches trying it out).
-- ============================================================================

insert into modules (key, name, description) values
  ('bible_games', 'Bible Games', 'Bible trivia quizzes with a church-wide scoreboard');

insert into plan_modules (plan_key, module_key) values
  ('free_trial', 'bible_games'),
  ('basic', 'bible_games'),
  ('premium', 'bible_games'),
  ('enterprise', 'bible_games'),
  ('sponsored', 'bible_games');

-- ----------------------------------------------------------------------------
-- Question bank — global content, not per-church (same trivia pool for
-- every church, like the Bible text itself). Original questions, not
-- copied from any existing trivia product or book.
-- ----------------------------------------------------------------------------
create table bible_quiz_questions (
  id              uuid primary key default uuid_generate_v4(),
  question        text not null,
  choices         jsonb not null,     -- array of 4 strings
  correct_index   integer not null check (correct_index between 0 and 3),
  category        text,               -- 'old_testament' | 'new_testament' | 'people' | 'numbers' | 'general'
  difficulty      text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  created_at      timestamptz not null default now()
);

alter table bible_quiz_questions enable row level security;

-- Readable by anyone signed in (needed to play); only super_admin can
-- add/edit questions for now — no in-app question editor built yet.
create policy bible_quiz_questions_select on bible_quiz_questions
  for select using (auth.uid() is not null);

create policy bible_quiz_questions_write on bible_quiz_questions
  for all using (is_super_admin()) with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Attempts — one row per completed quiz. The scoreboard is computed by
-- aggregating these, not stored as a separate running total, so it's
-- always correct even if history needs to be recalculated.
-- ----------------------------------------------------------------------------
create table bible_quiz_attempts (
  id              uuid primary key default uuid_generate_v4(),
  church_id       uuid not null references churches(id) on delete cascade,
  user_id         uuid not null references app_users(id) on delete cascade,
  score           integer not null,
  total_questions integer not null,
  created_at      timestamptz not null default now()
);

create index idx_quiz_attempts_church on bible_quiz_attempts(church_id, created_at desc);
create index idx_quiz_attempts_user on bible_quiz_attempts(user_id);

alter table bible_quiz_attempts enable row level security;

-- Everyone in the church can see everyone else's attempts — that's the
-- whole point of a scoreboard. Members can only ever insert their own.
create policy bible_quiz_attempts_select on bible_quiz_attempts
  for select using (is_super_admin() or church_id = current_church_id());

create policy bible_quiz_attempts_insert on bible_quiz_attempts
  for insert with check (user_id = auth.uid() and church_id = current_church_id());

-- ----------------------------------------------------------------------------
-- Seed question bank — 40 original trivia questions across categories.
-- ----------------------------------------------------------------------------
insert into bible_quiz_questions (question, choices, correct_index, category, difficulty) values
('Who built an ark to survive the flood?', '["Noah", "Abraham", "Moses", "Enoch"]', 0, 'old_testament', 'easy'),
('How many days and nights did it rain during the flood?', '["7", "40", "100", "365"]', 1, 'numbers', 'easy'),
('Who was swallowed by a great fish?', '["Jonah", "Elijah", "Daniel", "Ezekiel"]', 0, 'old_testament', 'easy'),
('What did God create on the first day?', '["Animals", "Light", "Man", "Plants"]', 1, 'old_testament', 'medium'),
('Who led the Israelites out of Egypt?', '["Joshua", "Aaron", "Moses", "David"]', 2, 'old_testament', 'easy'),
('How many plagues struck Egypt?', '["7", "10", "12", "40"]', 1, 'numbers', 'easy'),
('Who was the strongest man in the Bible, known for his hair?', '["Samson", "Goliath", "David", "Saul"]', 0, 'people', 'easy'),
('Who betrayed Jesus for 30 pieces of silver?', '["Peter", "Thomas", "Judas Iscariot", "John"]', 2, 'new_testament', 'easy'),
('How many disciples did Jesus have?', '["7", "10", "12", "14"]', 2, 'numbers', 'easy'),
('In which city was Jesus born?', '["Nazareth", "Jerusalem", "Bethlehem", "Capernaum"]', 2, 'new_testament', 'easy'),
('Who denied knowing Jesus three times?', '["Peter", "James", "Andrew", "Judas"]', 0, 'new_testament', 'easy'),
('What did Jesus turn water into at a wedding?', '["Oil", "Wine", "Milk", "Honey"]', 1, 'new_testament', 'easy'),
('Who killed the giant Goliath?', '["Saul", "Samuel", "David", "Solomon"]', 2, 'people', 'easy'),
('How many books are in the New Testament?', '["27", "39", "66", "12"]', 0, 'numbers', 'medium'),
('How many books are in the Old Testament?', '["27", "39", "66", "24"]', 1, 'numbers', 'medium'),
('Who was thrown into a den of lions?', '["Daniel", "Shadrach", "Elijah", "Jeremiah"]', 0, 'old_testament', 'easy'),
('Who was the wisest king of Israel?', '["David", "Saul", "Solomon", "Hezekiah"]', 2, 'people', 'easy'),
('What was the first miracle Jesus performed?', '["Healing a blind man", "Turning water into wine", "Feeding 5000", "Walking on water"]', 1, 'new_testament', 'medium'),
('Who was Adam and Eve''s first son?', '["Abel", "Seth", "Cain", "Enoch"]', 2, 'people', 'medium'),
('How many years did the Israelites wander the wilderness?', '["10", "20", "40", "70"]', 2, 'numbers', 'medium'),
('Who wrote most of the New Testament letters?', '["Peter", "Paul", "John", "James"]', 1, 'new_testament', 'medium'),
('What sea did Moses part?', '["Dead Sea", "Sea of Galilee", "Red Sea", "Mediterranean Sea"]', 2, 'old_testament', 'easy'),
('Who was the mother of Jesus?', '["Elizabeth", "Martha", "Mary", "Anna"]', 2, 'new_testament', 'easy'),
('What did God give Moses on Mount Sinai?', '["A crown", "The Ten Commandments", "A sword", "Manna"]', 1, 'old_testament', 'easy'),
('Who was thrown into a fiery furnace and survived?', '["Daniel", "Shadrach, Meshach, and Abednego", "Elijah", "Jonah"]', 1, 'old_testament', 'medium'),
('Which apostle was known as a tax collector before following Jesus?', '["Matthew", "Simon", "Philip", "Bartholomew"]', 0, 'new_testament', 'medium'),
('What is the shortest verse in the Bible often cited as?', '["Jesus wept", "God is love", "Pray always", "Rejoice always"]', 0, 'general', 'medium'),
('Who was sold into slavery by his brothers?', '["Benjamin", "Joseph", "Reuben", "Judah"]', 1, 'old_testament', 'easy'),
('How many sons did Jacob have?', '["10", "12", "7", "14"]', 1, 'numbers', 'medium'),
('On what day did God rest after creation?', '["Fifth", "Sixth", "Seventh", "Eighth"]', 2, 'old_testament', 'easy'),
('Who was the first king of Israel?', '["David", "Solomon", "Saul", "Samuel"]', 2, 'people', 'medium'),
('What did the angel tell Mary she would name her son?', '["John", "Jesus", "Emmanuel", "Joseph"]', 1, 'new_testament', 'easy'),
('Who walked on water toward Jesus before beginning to sink?', '["John", "Peter", "Andrew", "Thomas"]', 1, 'new_testament', 'easy'),
('How many loaves and fish fed the 5000?', '["2 loaves, 3 fish", "5 loaves, 2 fish", "7 loaves, 1 fish", "3 loaves, 5 fish"]', 1, 'numbers', 'medium'),
('What is the last book of the Bible?', '["Jude", "Revelation", "Acts", "Malachi"]', 1, 'general', 'easy'),
('What is the first book of the Bible?', '["Exodus", "Genesis", "Leviticus", "Psalms"]', 1, 'general', 'easy'),
('Who was known for his patience through great suffering?', '["Job", "Jeremiah", "Hosea", "Ezra"]', 0, 'people', 'medium'),
('What city''s walls fell after the Israelites marched around it?', '["Jericho", "Babylon", "Nineveh", "Damascus"]', 0, 'old_testament', 'medium'),
('Who anointed David as king while he was still a shepherd boy?', '["Samuel", "Nathan", "Elijah", "Saul"]', 0, 'people', 'hard'),
('On the road to which city did Paul have his conversion experience?', '["Rome", "Damascus", "Antioch", "Corinth"]', 1, 'new_testament', 'hard'),
('What was manna, according to the Exodus account?', '["A type of fish", "Bread from heaven", "A kind of fruit", "Honey from rocks"]', 1, 'old_testament', 'medium');
