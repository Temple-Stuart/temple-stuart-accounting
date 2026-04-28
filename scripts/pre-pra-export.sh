#!/bin/bash
set -e
mkdir -p docs/legacy-data
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
OUTFILE="docs/legacy-data/${TIMESTAMP}-pre-pra-export.json"

psql "$DATABASE_URL" <<'EOF' > /tmp/legacy_export.json
SELECT json_build_object(
  'exported_at', NOW(),
  'exported_by', 'pre-pra-export.sh',
  'purpose', 'Permanent pre-deletion archive for PR-A',
  'tables', json_build_object(
    'legacy_missions', (SELECT COALESCE(json_agg(t), '[]'::json) FROM legacy_missions t),
    'legacy_mission_stages', (SELECT COALESCE(json_agg(t), '[]'::json) FROM legacy_mission_stages t),
    'legacy_brain_dump_entries', (SELECT COALESCE(json_agg(t), '[]'::json) FROM legacy_brain_dump_entries t),
    'ops_questionnaire_answers', (SELECT COALESCE(json_agg(t), '[]'::json) FROM ops_questionnaire_answers t),
    'ops_workstream_analysis', (SELECT COALESCE(json_agg(t), '[]'::json) FROM ops_workstream_analysis t)
  )
)::text;
EOF

tail -n +3 /tmp/legacy_export.json | head -n -2 > "$OUTFILE"
echo "Exported to $OUTFILE"
