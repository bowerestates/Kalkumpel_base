-- Defense-in-depth: bound the numeric columns server-side. Rows are only ever
-- self-writable (RLS), but nothing stopped a client from storing absurd/negative
-- values. Added NOT VALID so the push never fails on any legacy row — the checks
-- still enforce on every new INSERT/UPDATE, which is the point.

-- entries: calories + macros
alter table public.entries
  add constraint entries_calories_bounds check (calories between 0 and 100000) not valid,
  add constraint entries_protein_bounds  check (protein  between 0 and 10000)  not valid,
  add constraint entries_carbs_bounds    check (carbs    between 0 and 10000)  not valid,
  add constraint entries_fat_bounds      check (fat      between 0 and 10000)  not valid;

-- profiles: demographics + goals
alter table public.profiles
  add constraint profiles_age_bounds       check (age       between 1  and 120)    not valid,
  add constraint profiles_height_bounds    check (height_cm between 30 and 300)    not valid,
  add constraint profiles_weight_bounds    check (weight_kg between 1  and 1000)   not valid,
  add constraint profiles_goal_cal_bounds  check (goal_calories between 0 and 100000) not valid,
  add constraint profiles_goal_prot_bounds check (goal_protein  between 0 and 10000)  not valid,
  add constraint profiles_goal_carb_bounds check (goal_carbs    between 0 and 10000)  not valid,
  add constraint profiles_goal_fat_bounds  check (goal_fat      between 0 and 10000)  not valid;

-- weights: body weight in kg
alter table public.weights
  add constraint weights_kg_bounds check (kg between 1 and 1000) not valid;
