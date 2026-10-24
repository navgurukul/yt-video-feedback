-- =====================================================================================
-- main_ro: MAIN's campus / student / attendance / English tables, readable from TEST.
--
-- Superset gets ONE database connection (TEST). The tables the tools do not own stay in MAIN
-- and are read live through postgres_fdw, read only:
--   * the foreign server is declared updatable = false (INSERT/UPDATE/DELETE are refused), and
--   * the user mapping should use a MAIN login that can only SELECT.
-- Nothing is created or changed in MAIN.
--
-- Run in TEST as a user allowed to create extensions (RDS: the master user / rds_superuser):
--   psql "<TEST connection>" -v ON_ERROR_STOP=1 \
--     -v main_host=<MAIN host> -v main_port=5432 -v main_db=ghar_central_db \
--     -v main_user=<read-only MAIN user> -v main_password='<password>' \
--     -f 10-main-ro-fdw.sql
-- Re-runnable (drops and re-imports the foreign tables, never touches MAIN).
-- Optional: the default is to COPY the tables into TEST (copy-dashboard-tables.js); this file is
-- for reading them live instead (then: apply-dash-views.js --src main_ro).
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SERVER IF EXISTS main_ro_srv CASCADE;     -- also drops the old foreign tables + user mappings
CREATE SERVER main_ro_srv FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host :'main_host', port :'main_port', dbname :'main_db', updatable 'false', fetch_size '2000');

CREATE USER MAPPING FOR PUBLIC SERVER main_ro_srv
  OPTIONS (user :'main_user', password :'main_password');

CREATE SCHEMA IF NOT EXISTS main_ro;
IMPORT FOREIGN SCHEMA public LIMIT TO (
  tbl_ghar_add_student,
  tbl_ghar_create_campus,
  tbl_ghar_assign_school_to_campus,
  "tbl_ghar_Write_Improve_Data",
  "tbl_ghar_Speak_Improve_Data",
  tbl_ghar_apply_leave,
  tbl_ghar_leave_type,
  tbl_ailabs_phasewise_parameter_weightages,
  tbl_ailabls_ytfeedback_phases,
  tbl_ailabls_ytfeedback_phasevideos
) FROM SERVER main_ro_srv INTO main_ro;

-- quick check
SELECT 'main_ro.' || foreign_table_name AS imported FROM information_schema.foreign_tables
 WHERE foreign_table_schema = 'main_ro' ORDER BY 1;
