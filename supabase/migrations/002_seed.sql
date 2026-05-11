-- Seed data for BeatLab skill graph
-- Uses fixed UUIDs for idempotent re-runs

-- SOUNDS (nodes)
insert into sounds (id, slug, name, symbol, category, description, technique, tips) values
  ('00000000-0000-0000-0000-000000000001', 'kick',        'Kick Drum',            'b',     'kick',  'The foundational kick drum sound.',
    array['Close lips tight', 'Release with a "B" explosion', 'Use chest air'],
    array['Keep lips relaxed before the burst', 'Aim for a deep thud, not a sharp pop']),

  ('00000000-0000-0000-0000-000000000002', 'hihat-closed','Hi-Hat Closed',        't',     'hat',   'Short, sharp closed hi-hat.',
    array['Touch tongue to roof of mouth', 'Release with a quick "T" click', 'Use minimal air'],
    array['Keep it tight and clipped', 'Speed comes with relaxation']),

  ('00000000-0000-0000-0000-000000000003', 'kick-soft',   'Kick Soft',            'bm',    'kick',  'A softer, more muted kick drum.',
    array['Same as kick but lips stay slightly loose', 'Muffle with lips after burst'],
    array['Let the lips damp the sound after the pop']),

  ('00000000-0000-0000-0000-000000000004', 'lip-bass',    'Lip Bass',             'bmm',   'bass',  'Continuous lip bass oscillation.',
    array['Vibrate both lips together', 'Control pitch with lip tension', 'Push air steadily'],
    array['Relax the lips fully', 'Think of a motorboat sound']),

  ('00000000-0000-0000-0000-000000000005', 'hihat-open',  'Hi-Hat Open',          'ts',    'hat',   'An open, slightly longer hi-hat.',
    array['Start with T click, let air hiss after', 'Tongue off roof of mouth quickly'],
    array['The "s" tail gives it the open feel']),

  ('00000000-0000-0000-0000-000000000006', 'hihat-long',  'Hi-Hat Long',          'tss',   'hat',   'A long open hi-hat with extended hiss.',
    array['Open T click into sustained hiss', 'Control hiss duration with airflow'],
    array['Great for ride cymbal feel', 'Keep the hiss consistent volume']),

  ('00000000-0000-0000-0000-000000000007', 'kh-pattern',  'Classic K-H Pattern',  'b+t',   'kick',  'Alternating kick and hi-hat combination exercise.',
    array['Alternate b and t smoothly', 'Keep rhythm even', 'Start slow then speed up'],
    array['This is the foundation of all beatboxing patterns']),

  ('00000000-0000-0000-0000-000000000008', 'snare',       'Snare',                'pf',    'snare', 'The classic snare drum sound.',
    array['Lips together, push air out in a "pf" burst', 'Let lips slap together', 'Use mid-range air pressure'],
    array['The lip slap creates the snare crack', 'Experiment with lip tension']),

  ('00000000-0000-0000-0000-000000000009', 'k-snare',     'K-Snare',              'ka',    'snare', 'Back-of-throat snare sound.',
    array['Use back of throat, "K" click with open mouth', 'Combine with forward air burst'],
    array['The "a" vowel shape after the k gives the snare body']),

  ('00000000-0000-0000-0000-00000000000A', 'snare-hard',  'Snare Hard',           'pff',   'snare', 'A harder, louder snare with more air.',
    array['Same as snare but push more air', 'Lips slap harder together'],
    array['Good for accents and drops']),

  ('00000000-0000-0000-0000-00000000000B', 'snare-soft',  'Snare Soft',           'psh',   'snare', 'A soft, brushed snare sound.',
    array['Let lips barely touch', 'Release with a soft "psh" whisper'],
    array['Think of a wire brush on a snare drum']),

  ('00000000-0000-0000-0000-00000000000C', 'khs-pattern', 'Classic K-H-S Pattern','b+t+pf','snare', 'Full kick, hi-hat, and snare combination exercise.',
    array['Combine all three foundational sounds', 'Build up to tempo gradually'],
    array['The bedrock pattern for most genres']),

  ('00000000-0000-0000-0000-00000000000D', 'throat-bass', 'Throat Bass',          'rrr',   'bass',  'Sustained throat bass growl.',
    array['Growl from the back of throat', 'Relax throat and push air through', 'Control pitch with throat tension'],
    array['Start with a gargling sensation', 'Build endurance gradually']),

  ('00000000-0000-0000-0000-00000000000E', 'wub-bass',    'Wub Bass',             'wub',   'bass',  'Dubstep-style wub bass modulation.',
    array['Combine lip bass with throat modulation', 'Shape mouth for "wub" vowel movement'],
    array['The w-to-u-to-b mouth shape creates the wobble effect']),

  ('00000000-0000-0000-0000-00000000000F', 'crash',       'Crash',                'ksh',   'hat',   'Crash cymbal burst.',
    array['Hard outward K then sustained sh hiss', 'Use full breath for the sh tail'],
    array['Tip the head back slightly to get more air on the sh']),

  ('00000000-0000-0000-0000-000000000010', 'shaker',      'Shaker',               'sss',   'fx',    'Shaker or maraca sound.',
    array['Sustained sibilant hiss through teeth', 'Keep teeth nearly closed'],
    array['Great for adding texture between main beats'])
on conflict (slug) do nothing;


-- SKILL GRAPH EDGES
-- condition: must score 72+ on 2 consecutive attempts
insert into skill_edges (from_sound_id, to_sound_id, condition_type, condition_value, label) values
  -- Kick unlocks Kick Soft and Lip Bass
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','mastery','{"min_score":72,"consecutive":2}','Master Kick'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','mastery','{"min_score":72,"consecutive":2}','Master Kick'),

  -- Hi-Hat Closed unlocks Hi-Hat Open and Hi-Hat Long
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','mastery','{"min_score":72,"consecutive":2}','Master Hi-Hat'),
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006','mastery','{"min_score":72,"consecutive":2}','Master Hi-Hat'),

  -- Kick + Hi-Hat both unlock Classic K-H Pattern
  -- (handled in app logic: node unlocked when both prerequisites mastered)
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000007','mastery','{"min_score":72,"consecutive":2,"also_requires":"00000000-0000-0000-0000-000000000002"}','Master Kick + Hi-Hat'),
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000007','mastery','{"min_score":72,"consecutive":2,"also_requires":"00000000-0000-0000-0000-000000000001"}','Master Kick + Hi-Hat'),

  -- Classic K-H Pattern unlocks Snare and K-Snare
  ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008','mastery','{"min_score":72,"consecutive":2}','Master K-H Pattern'),
  ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000009','mastery','{"min_score":72,"consecutive":2}','Master K-H Pattern'),

  -- Snare unlocks Snare Hard, Snare Soft, and Classic K-H-S Pattern
  ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-00000000000A','mastery','{"min_score":72,"consecutive":2}','Master Snare'),
  ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-00000000000B','mastery','{"min_score":72,"consecutive":2}','Master Snare'),
  ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-00000000000C','mastery','{"min_score":72,"consecutive":2}','Master Snare'),

  -- Lip Bass unlocks Throat Bass and Wub Bass
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000000D','mastery','{"min_score":72,"consecutive":2}','Master Lip Bass'),
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000000E','mastery','{"min_score":72,"consecutive":2}','Master Lip Bass'),

  -- Classic K-H-S Pattern unlocks Crash and Shaker
  ('00000000-0000-0000-0000-00000000000C','00000000-0000-0000-0000-00000000000F','mastery','{"min_score":72,"consecutive":2}','Master K-H-S Pattern'),
  ('00000000-0000-0000-0000-00000000000C','00000000-0000-0000-0000-000000000010','mastery','{"min_score":72,"consecutive":2}','Master K-H-S Pattern')
on conflict (from_sound_id, to_sound_id) do nothing;
