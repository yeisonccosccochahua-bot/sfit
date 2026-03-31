import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711411200000 implements MigrationInterface {
  name = 'InitialSchema1711411200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ENUMs
    await queryRunner.query(`
      CREATE TYPE "municipality_status_enum" AS ENUM ('ACTIVO', 'INACTIVO')
    `);
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM (
        'ADMIN_MUNICIPAL', 'FISCAL', 'OPERADOR_EMPRESA', 'CIUDADANO', 'INSPECTOR'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "user_status_enum" AS ENUM ('ACTIVO', 'BLOQUEADO', 'SUSPENDIDO')
    `);
    await queryRunner.query(`
      CREATE TYPE "company_status_enum" AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO')
    `);
    await queryRunner.query(`
      CREATE TYPE "vehicle_status_enum" AS ENUM (
        'ACTIVO', 'INACTIVO', 'EN_MANTENIMIENTO', 'SUSPENDIDO'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "driver_status_enum" AS ENUM ('APTO', 'RIESGO', 'NO_APTO')
    `);
    await queryRunner.query(`
      CREATE TYPE "route_type_enum" AS ENUM ('PREDEFINIDA', 'ESPECIAL')
    `);
    await queryRunner.query(`
      CREATE TYPE "route_status_enum" AS ENUM ('ACTIVO', 'INACTIVO')
    `);
    await queryRunner.query(`
      CREATE TYPE "trip_status_enum" AS ENUM (
        'REGISTRADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO', 'CERRADO_AUTO'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "fatigue_result_enum" AS ENUM ('APTO', 'RIESGO', 'NO_APTO')
    `);
    await queryRunner.query(`
      CREATE TYPE "trip_driver_role_enum" AS ENUM ('PRINCIPAL', 'SUPLENTE', 'COPILOTO')
    `);
    await queryRunner.query(`
      CREATE TYPE "report_type_enum" AS ENUM (
        'CONDUCTOR_DIFERENTE', 'CONDICION_VEHICULO',
        'CONDUCCION_PELIGROSA', 'EXCESO_VELOCIDAD', 'OTRO'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "report_status_enum" AS ENUM (
        'PENDIENTE', 'VALIDO', 'INVALIDO', 'EN_REVISION'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "appeal_status_enum" AS ENUM (
        'SIN_APELACION', 'EN_APELACION',
        'APELACION_ACEPTADA', 'APELACION_RECHAZADA'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "appeal_decision_status_enum" AS ENUM (
        'PENDIENTE', 'ACEPTADA', 'RECHAZADA'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "incentive_action_type_enum" AS ENUM (
        'REPORTE_VALIDO', 'REPORTE_CON_SANCION', 'BONUS'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "notification_channel_enum" AS ENUM ('WHATSAPP', 'EMAIL', 'WEB')
    `);
    await queryRunner.query(`
      CREATE TYPE "notification_status_enum" AS ENUM (
        'PENDIENTE', 'ENVIADO', 'FALLIDO', 'LEIDO'
      )
    `);

    // municipalities
    await queryRunner.query(`
      CREATE TABLE "municipalities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "province" character varying(100) NOT NULL,
        "district" character varying(100) NOT NULL,
        "region" character varying(100) NOT NULL,
        "config_json" jsonb,
        "status" "municipality_status_enum" NOT NULL DEFAULT 'ACTIVO',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_municipalities" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_municipalities_status" ON "municipalities" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_municipalities_created_at" ON "municipalities" ("created_at")`);

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(200) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "role" "user_role_enum" NOT NULL,
        "municipality_id" uuid,
        "dni" character varying(15),
        "name" character varying(200) NOT NULL,
        "phone" character varying(20),
        "reputation_score" integer NOT NULL DEFAULT 100,
        "total_points" integer NOT NULL DEFAULT 0,
        "reports_today" integer NOT NULL DEFAULT 0,
        "status" "user_status_enum" NOT NULL DEFAULT 'ACTIVO',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_municipality" FOREIGN KEY ("municipality_id")
          REFERENCES "municipalities"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_dni" ON "users" ("dni")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_municipality_id" ON "users" ("municipality_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_status" ON "users" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_created_at" ON "users" ("created_at")`);

    // companies
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ruc" character varying(11) NOT NULL,
        "name" character varying(200) NOT NULL,
        "address" character varying(300),
        "license" character varying(100),
        "municipality_id" uuid NOT NULL,
        "status" "company_status_enum" NOT NULL DEFAULT 'ACTIVO',
        "reputation_score" integer NOT NULL DEFAULT 100,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_companies_ruc" UNIQUE ("ruc"),
        CONSTRAINT "PK_companies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_companies_municipality" FOREIGN KEY ("municipality_id")
          REFERENCES "municipalities"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_companies_municipality_id" ON "companies" ("municipality_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_companies_status" ON "companies" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_companies_created_at" ON "companies" ("created_at")`);

    // vehicles
    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plate" character varying(10) NOT NULL,
        "qr_code" character varying(255) NOT NULL,
        "qr_hmac" character varying(255) NOT NULL,
        "company_id" uuid NOT NULL,
        "status" "vehicle_status_enum" NOT NULL DEFAULT 'ACTIVO',
        "reputation_score" integer NOT NULL DEFAULT 100,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_vehicles_plate" UNIQUE ("plate"),
        CONSTRAINT "UQ_vehicles_qr_code" UNIQUE ("qr_code"),
        CONSTRAINT "PK_vehicles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicles_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_plate" ON "vehicles" ("plate")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_qr_code" ON "vehicles" ("qr_code")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_company_id" ON "vehicles" ("company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_status" ON "vehicles" ("status")`);

    // drivers
    await queryRunner.query(`
      CREATE TABLE "drivers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dni" character varying(15) NOT NULL,
        "name" character varying(200) NOT NULL,
        "license_number" character varying(50),
        "license_photo_url" character varying(500),
        "photo_expires_at" TIMESTAMP WITH TIME ZONE,
        "company_id" uuid NOT NULL,
        "reputation_score" integer NOT NULL DEFAULT 100,
        "status" "driver_status_enum" NOT NULL DEFAULT 'APTO',
        "total_hours_driven_24h" numeric(5,2) NOT NULL DEFAULT 0,
        "last_rest_start" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_drivers_dni" UNIQUE ("dni"),
        CONSTRAINT "PK_drivers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_drivers_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_drivers_dni" ON "drivers" ("dni")`);
    await queryRunner.query(`CREATE INDEX "IDX_drivers_company_id" ON "drivers" ("company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_drivers_status" ON "drivers" ("status")`);

    // routes
    await queryRunner.query(`
      CREATE TABLE "routes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "origin" character varying(200) NOT NULL,
        "destination" character varying(200) NOT NULL,
        "stops" jsonb,
        "estimated_duration_minutes" integer NOT NULL,
        "type" "route_type_enum" NOT NULL,
        "min_drivers" integer NOT NULL DEFAULT 1,
        "rest_between_legs_hours" numeric(4,1),
        "allows_roundtrip" boolean NOT NULL DEFAULT false,
        "municipality_id" uuid NOT NULL,
        "authorized_by_id" uuid,
        "status" "route_status_enum" NOT NULL DEFAULT 'ACTIVO',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_routes_municipality" FOREIGN KEY ("municipality_id")
          REFERENCES "municipalities"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_routes_authorized_by" FOREIGN KEY ("authorized_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_routes_municipality_id" ON "routes" ("municipality_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_routes_status" ON "routes" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_routes_created_at" ON "routes" ("created_at")`);

    // trips
    await queryRunner.query(`
      CREATE TABLE "trips" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vehicle_id" uuid NOT NULL,
        "route_id" uuid NOT NULL,
        "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_time" TIMESTAMP WITH TIME ZONE,
        "status" "trip_status_enum" NOT NULL DEFAULT 'REGISTRADO',
        "fatigue_result" "fatigue_result_enum",
        "auto_closed" boolean NOT NULL DEFAULT false,
        "is_return_leg" boolean NOT NULL DEFAULT false,
        "parent_trip_id" uuid,
        "municipality_id" uuid NOT NULL,
        "registered_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trips" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trips_vehicle" FOREIGN KEY ("vehicle_id")
          REFERENCES "vehicles"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_trips_route" FOREIGN KEY ("route_id")
          REFERENCES "routes"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_trips_parent" FOREIGN KEY ("parent_trip_id")
          REFERENCES "trips"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_trips_municipality" FOREIGN KEY ("municipality_id")
          REFERENCES "municipalities"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_trips_registered_by" FOREIGN KEY ("registered_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_trips_vehicle_id" ON "trips" ("vehicle_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_trips_route_id" ON "trips" ("route_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_trips_status" ON "trips" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_trips_municipality_id" ON "trips" ("municipality_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_trips_created_at" ON "trips" ("created_at")`);

    // trip_drivers
    await queryRunner.query(`
      CREATE TABLE "trip_drivers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "trip_id" uuid NOT NULL,
        "driver_id" uuid NOT NULL,
        "role" "trip_driver_role_enum" NOT NULL,
        "fatigue_check_result" "fatigue_result_enum",
        "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_drivers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trip_drivers_trip" FOREIGN KEY ("trip_id")
          REFERENCES "trips"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_trip_drivers_driver" FOREIGN KEY ("driver_id")
          REFERENCES "drivers"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_trip_drivers_trip_id" ON "trip_drivers" ("trip_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_trip_drivers_driver_id" ON "trip_drivers" ("driver_id")`);

    // fatigue_logs
    await queryRunner.query(`
      CREATE TABLE "fatigue_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL,
        "evaluation_date" date NOT NULL,
        "hours_driven_24h" numeric(5,2) NOT NULL,
        "last_rest_hours" numeric(5,2) NOT NULL,
        "result" "fatigue_result_enum" NOT NULL,
        "details_json" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fatigue_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fatigue_logs_driver" FOREIGN KEY ("driver_id")
          REFERENCES "drivers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_fatigue_logs_driver_id" ON "fatigue_logs" ("driver_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_fatigue_logs_created_at" ON "fatigue_logs" ("created_at")`);

    // reports
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "trip_id" uuid NOT NULL,
        "citizen_id" uuid NOT NULL,
        "type" "report_type_enum" NOT NULL,
        "description" text,
        "photo_url" character varying(500),
        "status" "report_status_enum" NOT NULL DEFAULT 'PENDIENTE',
        "validation_score" numeric(5,2),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reports_trip" FOREIGN KEY ("trip_id")
          REFERENCES "trips"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_reports_citizen" FOREIGN KEY ("citizen_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_reports_trip_id" ON "reports" ("trip_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_citizen_id" ON "reports" ("citizen_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_status" ON "reports" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_reports_created_at" ON "reports" ("created_at")`);

    // sanctions
    await queryRunner.query(`
      CREATE TABLE "sanctions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL,
        "level" smallint NOT NULL,
        "reason" text NOT NULL,
        "evidence_ids" jsonb,
        "appeal_status" "appeal_status_enum" NOT NULL DEFAULT 'SIN_APELACION',
        "appeal_deadline" TIMESTAMP WITH TIME ZONE,
        "fine_amount" numeric(10,2),
        "municipality_id" uuid NOT NULL,
        "issued_by_id" uuid,
        "resolved_date" date,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sanctions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sanctions_driver" FOREIGN KEY ("driver_id")
          REFERENCES "drivers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_sanctions_municipality" FOREIGN KEY ("municipality_id")
          REFERENCES "municipalities"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_sanctions_issued_by" FOREIGN KEY ("issued_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_sanctions_driver_id" ON "sanctions" ("driver_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_sanctions_municipality_id" ON "sanctions" ("municipality_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_sanctions_created_at" ON "sanctions" ("created_at")`);

    // appeals
    await queryRunner.query(`
      CREATE TABLE "appeals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sanction_id" uuid NOT NULL,
        "description" text NOT NULL,
        "evidence_urls" jsonb,
        "status" "appeal_decision_status_enum" NOT NULL DEFAULT 'PENDIENTE',
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "resolved_by_id" uuid,
        CONSTRAINT "PK_appeals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_appeals_sanction" FOREIGN KEY ("sanction_id")
          REFERENCES "sanctions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_appeals_resolved_by" FOREIGN KEY ("resolved_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_appeals_sanction_id" ON "appeals" ("sanction_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_appeals_status" ON "appeals" ("status")`);

    // incentive_points
    await queryRunner.query(`
      CREATE TABLE "incentive_points" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "citizen_id" uuid NOT NULL,
        "points" integer NOT NULL,
        "action_type" "incentive_action_type_enum" NOT NULL,
        "report_id" uuid,
        "date" date NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_incentive_points" PRIMARY KEY ("id"),
        CONSTRAINT "FK_incentive_points_citizen" FOREIGN KEY ("citizen_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_incentive_points_report" FOREIGN KEY ("report_id")
          REFERENCES "reports"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_incentive_points_citizen_id" ON "incentive_points" ("citizen_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_incentive_points_report_id" ON "incentive_points" ("report_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_incentive_points_created_at" ON "incentive_points" ("created_at")`);

    // notifications
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "channel" "notification_channel_enum" NOT NULL,
        "type" character varying(100) NOT NULL,
        "title" character varying(200) NOT NULL,
        "content" text NOT NULL,
        "status" "notification_status_enum" NOT NULL DEFAULT 'PENDIENTE',
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user_id" ON "notifications" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_status" ON "notifications" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_created_at" ON "notifications" ("created_at")`);

    // audit_logs
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "action" character varying(100) NOT NULL,
        "entity_type" character varying(100) NOT NULL,
        "entity_id" character varying(100) NOT NULL,
        "details_json" jsonb,
        "ip" character varying(45),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity_type" ON "audit_logs" ("entity_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity_id" ON "audit_logs" ("entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incentive_points" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "appeals" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sanctions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fatigue_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_drivers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trips" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "routes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drivers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "companies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "municipalities" CASCADE`);

    await queryRunner.query(`DROP TYPE IF EXISTS "notification_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_channel_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "incentive_action_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "appeal_decision_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "appeal_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "trip_driver_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "fatigue_result_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "trip_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "route_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "route_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "driver_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicle_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "company_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "municipality_status_enum"`);
  }
}
