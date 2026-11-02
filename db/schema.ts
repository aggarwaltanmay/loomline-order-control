import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(), role: text("role").notNull(),
  buyerId: text("buyer_id"), unitId: text("unit_id"),
  passwordSalt: text("password_salt").notNull(), passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(), userEmail: text("user_email").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), po: text("po").notNull().unique(),
  buyerId: text("buyer_id").notNull(), buyerName: text("buyer_name").notNull(),
  style: text("style").notNull(), color: text("color").notNull(),
  sizesJson: text("sizes_json").notNull(), qty: integer("qty").notNull(),
  exFactory: text("ex_factory").notNull(), unitId: text("unit_id").notNull(),
  stage: text("stage").notNull(), stageDone: integer("stage_done").notNull().default(0),
  baselineDaily: integer("baseline_daily").notNull().default(0),
  buyerWarningConfirmed: integer("buyer_warning_confirmed").notNull().default(0),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull(),
  name: text("name").notNull(), dueDate: text("due_date").notNull(),
  sequence: integer("sequence").notNull(),
});

export const updates = sqliteTable("updates", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull(),
  stage: text("stage").notNull(), dailyQty: integer("daily_qty").notNull(),
  updateDate: text("update_date").notNull(), note: text("note").notNull().default(""),
  englishSummary: text("english_summary"), category: text("category"),
  confidence: text("confidence"), photoKey: text("photo_key"),
  actorEmail: text("actor_email").notNull(), createdAt: text("created_at").notNull(),
});

export const dateChanges = sqliteTable("date_changes", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull(),
  field: text("field").notNull(), oldDate: text("old_date").notNull(),
  newDate: text("new_date").notNull(), reason: text("reason").notNull(),
  actorEmail: text("actor_email").notNull(), changedAt: text("changed_at").notNull(),
});
