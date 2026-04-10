-- Normalize user_skills.skill_name from terminal node ids to canonical ProGoalIds.
-- Before: skill_name stored terminal node ids like "strict-mu", "full-fl".
-- After:  skill_name stores canonical goal ids like "muscle-up", "front-lever".
-- Rows for goals without a ProGoalId mapping (e.g. "one-arm-pullup") are left unchanged.

update user_skills set skill_name = 'muscle-up'        where skill_name = 'strict-mu';
update user_skills set skill_name = 'front-lever'      where skill_name = 'full-fl';
update user_skills set skill_name = 'back-lever'       where skill_name = 'full-bl';
update user_skills set skill_name = 'handstand'        where skill_name = 'freestanding-hs';
update user_skills set skill_name = 'handstand-pushup' where skill_name = 'hspu';
update user_skills set skill_name = 'l-sit'            where skill_name = 'l-sit-30sec';
update user_skills set skill_name = 'pistol-squat'     where skill_name = 'standard-pistol';
