## Current Query

```sql
SELECT *
FROM engagement_events
WHERE org = 'sga'
  AND event_date >= NOW() - INTERVAL '90 days'
ORDER BY event_date DESC;
