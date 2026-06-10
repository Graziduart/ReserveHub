-- Nome de departamento único (case-insensitive, ignorando espaços nas pontas).
-- Renomeia e desativa duplicados mais recentes, mantendo o registo mais antigo por nome.

WITH ranked AS (
  SELECT
    id,
    sigla,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(name))
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM core.departments
)
UPDATE core.departments AS d
SET
  name = TRIM(d.name) || ' [' || d.sigla || ']',
  active = false,
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked AS r
WHERE d.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_lower_key"
  ON core.departments (LOWER(TRIM(name)));
