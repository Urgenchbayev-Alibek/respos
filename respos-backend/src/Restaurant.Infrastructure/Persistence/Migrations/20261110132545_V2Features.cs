using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class V2Features : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "bill_id",
                table: "payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tip_amount",
                table: "payments",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "customer_id",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "delivery_fee",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "is_split",
                table: "orders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "loyalty_discount_amount",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "default_supplier_id",
                table: "ingredients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "slug",
                table: "branches",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "delivery_fee",
                table: "branch_settings",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "branch_menu_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    menu_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    price_override = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    is_available = table.Column<bool>(type: "boolean", nullable: true),
                    kitchen_station_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_branch_menu_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_branch_menu_items_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_branch_menu_items_kitchen_stations_kitchen_station_id",
                        column: x => x.kitchen_station_id,
                        principalTable: "kitchen_stations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_branch_menu_items_menu_items_menu_item_id",
                        column: x => x.menu_item_id,
                        principalTable: "menu_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_branch_menu_items_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "branch_payment_providers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_branch_payment_providers", x => x.id);
                    table.ForeignKey(
                        name: "fk_branch_payment_providers_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_branch_payment_providers_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "couriers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_couriers", x => x.id);
                    table.ForeignKey(
                        name: "fk_couriers_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_couriers_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "customers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    birthday = table.Column<DateOnly>(type: "date", nullable: true),
                    birthday_key = table.Column<int>(type: "integer", nullable: true),
                    gender = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    tags = table.Column<List<string>>(type: "text[]", nullable: false),
                    marketing_consent = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_customers", x => x.id);
                    table.ForeignKey(
                        name: "fk_customers_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "data_protection_keys",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    friendly_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    xml = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_data_protection_keys", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "integration_error_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: true),
                    integration_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    channel = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    operation = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    outbound_message_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_integration_error_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_integration_error_logs_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "integration_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    protected_config = table.Column<string>(type: "character varying(16000)", maxLength: 16000, nullable: true),
                    last_success_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_error_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_integration_settings", x => x.id);
                    table.ForeignKey(
                        name: "fk_integration_settings_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "loyalty_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    earn_percent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    max_redeem_percent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    min_order_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    points_expiry_days = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_loyalty_settings", x => x.id);
                    table.ForeignKey(
                        name: "fk_loyalty_settings_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_bills",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<int>(type: "integer", nullable: false),
                    mode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    paid_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_bills", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_bills_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "outbound_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    channel = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    kind = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    recipient_masked = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    summary = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    protected_payload = table.Column<string>(type: "character varying(64000)", maxLength: 64000, nullable: false),
                    dedupe_key = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    max_attempts = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_error = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_outbound_messages", x => x.id);
                    table.ForeignKey(
                        name: "fk_outbound_messages_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shift_schedules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    start_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    end_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    role_note = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shift_schedules", x => x.id);
                    table.ForeignKey(
                        name: "fk_shift_schedules_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_shift_schedules_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_shift_schedules_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "staff_devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revoked_by = table.Column<Guid>(type: "uuid", nullable: true),
                    failed_pin_count = table.Column<int>(type: "integer", nullable: false),
                    lockout_until = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staff_devices", x => x.id);
                    table.ForeignKey(
                        name: "fk_staff_devices_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_staff_devices_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_staff_devices_users_revoked_by",
                        column: x => x.revoked_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "staff_pins",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pin_hash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    failed_count = table.Column<int>(type: "integer", nullable: false),
                    lockout_until = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staff_pins", x => x.id);
                    table.ForeignKey(
                        name: "fk_staff_pins_users_updated_by",
                        column: x => x.updated_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_staff_pins_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_transfers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<int>(type: "integer", nullable: false),
                    from_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    to_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    sent_by = table.Column<Guid>(type: "uuid", nullable: true),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    received_by = table.Column<Guid>(type: "uuid", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_by = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_transfers", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_transfers_branches_from_branch_id",
                        column: x => x.from_branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stock_transfers_branches_to_branch_id",
                        column: x => x.to_branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stock_transfers_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "time_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    clock_in_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    clock_out_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    break_minutes = table.Column<int>(type: "integer", nullable: false),
                    source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    edited_by = table.Column<Guid>(type: "uuid", nullable: true),
                    edited_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    edit_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_time_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_time_entries_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_time_entries_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_time_entries_users_edited_by",
                        column: x => x.edited_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_time_entries_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "waiter_calls",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    table_id = table.Column<Guid>(type: "uuid", nullable: false),
                    table_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    reason = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    acknowledged_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    acknowledged_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_waiter_calls", x => x.id);
                    table.ForeignKey(
                        name: "fk_waiter_calls_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_waiter_calls_dining_tables_table_id",
                        column: x => x.table_id,
                        principalTable: "dining_tables",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_waiter_calls_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "branch_menu_item_variant_prices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_menu_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    variant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_branch_menu_item_variant_prices", x => x.id);
                    table.ForeignKey(
                        name: "fk_branch_menu_item_variant_prices_branch_menu_items_branch_me",
                        column: x => x.branch_menu_item_id,
                        principalTable: "branch_menu_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_branch_menu_item_variant_prices_menu_item_variants_variant_",
                        column: x => x.variant_id,
                        principalTable: "menu_item_variants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_deliveries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    customer_phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    entrance = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    floor = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    apartment = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    courier_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status_changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    accepted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cooking_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ready_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    on_the_way_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    delivered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancel_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_deliveries", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_deliveries_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_order_deliveries_couriers_courier_id",
                        column: x => x.courier_id,
                        principalTable: "couriers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_order_deliveries_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_order_deliveries_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "loyalty_accounts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    balance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    lifetime_earned = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    lifetime_redeemed = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_loyalty_accounts", x => x.id);
                    table.ForeignKey(
                        name: "fk_loyalty_accounts_customers_customer_id",
                        column: x => x.customer_id,
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_loyalty_accounts_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_bill_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    bill_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_bill_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_bill_items_order_bills_bill_id",
                        column: x => x.bill_id,
                        principalTable: "order_bills",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_order_bill_items_order_items_order_item_id",
                        column: x => x.order_item_id,
                        principalTable: "order_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payment_intents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bill_id = table.Column<Guid>(type: "uuid", nullable: true),
                    cash_shift_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    tip_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    payment_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    provider_transaction_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    provider_time = table.Column<long>(type: "bigint", nullable: true),
                    provider_prepare_id = table.Column<long>(type: "bigint", nullable: true),
                    provider_state = table.Column<int>(type: "integer", nullable: false),
                    provider_created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    performed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancel_reason = table.Column<int>(type: "integer", nullable: true),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payment_intents", x => x.id);
                    table.ForeignKey(
                        name: "fk_payment_intents_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_payment_intents_cash_shifts_cash_shift_id",
                        column: x => x.cash_shift_id,
                        principalTable: "cash_shifts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_payment_intents_order_bills_bill_id",
                        column: x => x.bill_id,
                        principalTable: "order_bills",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_payment_intents_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_payment_intents_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_payment_intents_payments_payment_id",
                        column: x => x.payment_id,
                        principalTable: "payments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pin_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    family_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pin_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_pin_sessions_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pin_sessions_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_pin_sessions_staff_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "staff_devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_pin_sessions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_transfer_lines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    stock_transfer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ingredient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    unit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    base_quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    unit_cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_transfer_lines", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_transfer_lines_ingredients_ingredient_id",
                        column: x => x.ingredient_id,
                        principalTable: "ingredients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stock_transfer_lines_stock_transfers_stock_transfer_id",
                        column: x => x.stock_transfer_id,
                        principalTable: "stock_transfers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_stock_transfer_lines_units_unit_id",
                        column: x => x.unit_id,
                        principalTable: "units_of_measure",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "loyalty_transactions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    reason = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    points = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    balance_after = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    remaining_points = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_loyalty_transactions", x => x.id);
                    table.ForeignKey(
                        name: "fk_loyalty_transactions_loyalty_accounts_account_id",
                        column: x => x.account_id,
                        principalTable: "loyalty_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_loyalty_transactions_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_loyalty_transactions_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_payments_bill_id",
                table: "payments",
                column: "bill_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_customer_id",
                table: "orders",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_ingredients_default_supplier_id",
                table: "ingredients",
                column: "default_supplier_id");

            migrationBuilder.CreateIndex(
                name: "ix_branches_slug",
                table: "branches",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_branch_menu_item_variant_prices_branch_menu_item_id_variant",
                table: "branch_menu_item_variant_prices",
                columns: new[] { "branch_menu_item_id", "variant_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_branch_menu_item_variant_prices_variant_id",
                table: "branch_menu_item_variant_prices",
                column: "variant_id");

            migrationBuilder.CreateIndex(
                name: "ix_branch_menu_items_branch_id_menu_item_id",
                table: "branch_menu_items",
                columns: new[] { "branch_id", "menu_item_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_branch_menu_items_kitchen_station_id",
                table: "branch_menu_items",
                column: "kitchen_station_id");

            migrationBuilder.CreateIndex(
                name: "ix_branch_menu_items_menu_item_id",
                table: "branch_menu_items",
                column: "menu_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_branch_menu_items_organization_id",
                table: "branch_menu_items",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_branch_menu_items_organization_id_branch_id",
                table: "branch_menu_items",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_branch_payment_providers_branch_id_provider",
                table: "branch_payment_providers",
                columns: new[] { "branch_id", "provider" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_branch_payment_providers_organization_id",
                table: "branch_payment_providers",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_branch_payment_providers_organization_id_branch_id",
                table: "branch_payment_providers",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_couriers_branch_id",
                table: "couriers",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "ix_couriers_organization_id",
                table: "couriers",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_couriers_organization_id_branch_id",
                table: "couriers",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_customers_organization_id",
                table: "customers",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_customers_organization_id_birthday_key",
                table: "customers",
                columns: new[] { "organization_id", "birthday_key" });

            migrationBuilder.CreateIndex(
                name: "ix_customers_organization_id_created_at",
                table: "customers",
                columns: new[] { "organization_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_customers_organization_id_phone",
                table: "customers",
                columns: new[] { "organization_id", "phone" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_integration_error_logs_created_at",
                table: "integration_error_logs",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_integration_error_logs_organization_id_created_at",
                table: "integration_error_logs",
                columns: new[] { "organization_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_integration_settings_organization_id",
                table: "integration_settings",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_integration_settings_organization_id_type",
                table: "integration_settings",
                columns: new[] { "organization_id", "type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_accounts_customer_id",
                table: "loyalty_accounts",
                column: "customer_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_accounts_organization_id",
                table: "loyalty_accounts",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_settings_organization_id",
                table: "loyalty_settings",
                column: "organization_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_transactions_account_id_remaining_points",
                table: "loyalty_transactions",
                columns: new[] { "account_id", "remaining_points" });

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_transactions_customer_id_created_at",
                table: "loyalty_transactions",
                columns: new[] { "customer_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_transactions_order_id_type",
                table: "loyalty_transactions",
                columns: new[] { "order_id", "type" },
                unique: true,
                filter: "order_id IS NOT NULL AND type = 'earn'");

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_transactions_organization_id",
                table: "loyalty_transactions",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_bill_items_bill_id",
                table: "order_bill_items",
                column: "bill_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_bill_items_order_item_id",
                table: "order_bill_items",
                column: "order_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_bills_order_id_number",
                table: "order_bills",
                columns: new[] { "order_id", "number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_order_deliveries_branch_id_status",
                table: "order_deliveries",
                columns: new[] { "branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_order_deliveries_courier_id",
                table: "order_deliveries",
                column: "courier_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_deliveries_order_id",
                table: "order_deliveries",
                column: "order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_order_deliveries_organization_id",
                table: "order_deliveries",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_deliveries_organization_id_branch_id",
                table: "order_deliveries",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_outbound_messages_dedupe_key",
                table: "outbound_messages",
                column: "dedupe_key",
                unique: true,
                filter: "dedupe_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_outbound_messages_organization_id_created_at",
                table: "outbound_messages",
                columns: new[] { "organization_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_outbound_messages_status_next_attempt_at",
                table: "outbound_messages",
                columns: new[] { "status", "next_attempt_at" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_bill_id",
                table: "payment_intents",
                column: "bill_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_branch_id",
                table: "payment_intents",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_cash_shift_id",
                table: "payment_intents",
                column: "cash_shift_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_order_id_status",
                table: "payment_intents",
                columns: new[] { "order_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_organization_id",
                table: "payment_intents",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_organization_id_branch_id",
                table: "payment_intents",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_payment_id",
                table: "payment_intents",
                column: "payment_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_provider_provider_time",
                table: "payment_intents",
                columns: new[] { "provider", "provider_time" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_provider_provider_transaction_id",
                table: "payment_intents",
                columns: new[] { "provider", "provider_transaction_id" },
                unique: true,
                filter: "provider_transaction_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_pin_sessions_branch_id",
                table: "pin_sessions",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "ix_pin_sessions_device_id",
                table: "pin_sessions",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ix_pin_sessions_family_id",
                table: "pin_sessions",
                column: "family_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pin_sessions_organization_id",
                table: "pin_sessions",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_pin_sessions_user_id",
                table: "pin_sessions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_shift_schedules_branch_id_date",
                table: "shift_schedules",
                columns: new[] { "branch_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_shift_schedules_organization_id",
                table: "shift_schedules",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_shift_schedules_organization_id_branch_id",
                table: "shift_schedules",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_shift_schedules_user_id_date",
                table: "shift_schedules",
                columns: new[] { "user_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_staff_devices_branch_id",
                table: "staff_devices",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_devices_organization_id",
                table: "staff_devices",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_devices_organization_id_branch_id",
                table: "staff_devices",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_staff_devices_revoked_by",
                table: "staff_devices",
                column: "revoked_by");

            migrationBuilder.CreateIndex(
                name: "ix_staff_devices_token_hash",
                table: "staff_devices",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staff_pins_updated_by",
                table: "staff_pins",
                column: "updated_by");

            migrationBuilder.CreateIndex(
                name: "ix_staff_pins_user_id",
                table: "staff_pins",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfer_lines_ingredient_id",
                table: "stock_transfer_lines",
                column: "ingredient_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfer_lines_stock_transfer_id",
                table: "stock_transfer_lines",
                column: "stock_transfer_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfer_lines_unit_id",
                table: "stock_transfer_lines",
                column: "unit_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfers_from_branch_id_status",
                table: "stock_transfers",
                columns: new[] { "from_branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfers_organization_id",
                table: "stock_transfers",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfers_organization_id_number",
                table: "stock_transfers",
                columns: new[] { "organization_id", "number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfers_to_branch_id_status",
                table: "stock_transfers",
                columns: new[] { "to_branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_time_entries_branch_id_clock_in_at",
                table: "time_entries",
                columns: new[] { "branch_id", "clock_in_at" });

            migrationBuilder.CreateIndex(
                name: "ix_time_entries_edited_by",
                table: "time_entries",
                column: "edited_by");

            migrationBuilder.CreateIndex(
                name: "ix_time_entries_org_user_open",
                table: "time_entries",
                columns: new[] { "organization_id", "user_id" },
                unique: true,
                filter: "clock_out_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_time_entries_organization_id",
                table: "time_entries",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_time_entries_organization_id_branch_id",
                table: "time_entries",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_time_entries_user_id_clock_in_at",
                table: "time_entries",
                columns: new[] { "user_id", "clock_in_at" });

            migrationBuilder.CreateIndex(
                name: "ix_waiter_calls_branch_id_status_created_at",
                table: "waiter_calls",
                columns: new[] { "branch_id", "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_waiter_calls_organization_id",
                table: "waiter_calls",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_waiter_calls_organization_id_branch_id",
                table: "waiter_calls",
                columns: new[] { "organization_id", "branch_id" });

            migrationBuilder.CreateIndex(
                name: "ix_waiter_calls_table_id",
                table: "waiter_calls",
                column: "table_id");

            migrationBuilder.AddForeignKey(
                name: "fk_ingredients_suppliers_default_supplier_id",
                table: "ingredients",
                column: "default_supplier_id",
                principalTable: "suppliers",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_orders_customers_customer_id",
                table: "orders",
                column: "customer_id",
                principalTable: "customers",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_payments_order_bills_bill_id",
                table: "payments",
                column: "bill_id",
                principalTable: "order_bills",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_ingredients_suppliers_default_supplier_id",
                table: "ingredients");

            migrationBuilder.DropForeignKey(
                name: "fk_orders_customers_customer_id",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "fk_payments_order_bills_bill_id",
                table: "payments");

            migrationBuilder.DropTable(
                name: "branch_menu_item_variant_prices");

            migrationBuilder.DropTable(
                name: "branch_payment_providers");

            migrationBuilder.DropTable(
                name: "data_protection_keys");

            migrationBuilder.DropTable(
                name: "integration_error_logs");

            migrationBuilder.DropTable(
                name: "integration_settings");

            migrationBuilder.DropTable(
                name: "loyalty_settings");

            migrationBuilder.DropTable(
                name: "loyalty_transactions");

            migrationBuilder.DropTable(
                name: "order_bill_items");

            migrationBuilder.DropTable(
                name: "order_deliveries");

            migrationBuilder.DropTable(
                name: "outbound_messages");

            migrationBuilder.DropTable(
                name: "payment_intents");

            migrationBuilder.DropTable(
                name: "pin_sessions");

            migrationBuilder.DropTable(
                name: "shift_schedules");

            migrationBuilder.DropTable(
                name: "staff_pins");

            migrationBuilder.DropTable(
                name: "stock_transfer_lines");

            migrationBuilder.DropTable(
                name: "time_entries");

            migrationBuilder.DropTable(
                name: "waiter_calls");

            migrationBuilder.DropTable(
                name: "branch_menu_items");

            migrationBuilder.DropTable(
                name: "loyalty_accounts");

            migrationBuilder.DropTable(
                name: "couriers");

            migrationBuilder.DropTable(
                name: "order_bills");

            migrationBuilder.DropTable(
                name: "staff_devices");

            migrationBuilder.DropTable(
                name: "stock_transfers");

            migrationBuilder.DropTable(
                name: "customers");

            migrationBuilder.DropIndex(
                name: "ix_payments_bill_id",
                table: "payments");

            migrationBuilder.DropIndex(
                name: "ix_orders_customer_id",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ix_ingredients_default_supplier_id",
                table: "ingredients");

            migrationBuilder.DropIndex(
                name: "ix_branches_slug",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "bill_id",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "tip_amount",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "customer_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "delivery_fee",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "is_split",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "loyalty_discount_amount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "default_supplier_id",
                table: "ingredients");

            migrationBuilder.DropColumn(
                name: "slug",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "delivery_fee",
                table: "branch_settings");
        }
    }
}
