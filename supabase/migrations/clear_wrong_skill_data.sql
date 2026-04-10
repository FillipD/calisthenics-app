-- Clear all existing user_skills rows that have wrong current_progression values.
-- After running this, users will need to re-set their skill goals from the skills page.
-- The save logic now correctly computes the first step of each skill branch.
delete from user_skills;
