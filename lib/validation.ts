import { z } from "zod";
import { statuses } from "./types";
const name = z.string().trim().min(1).max(200);
const uuid = z.uuid();
export const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("project"),
    name,
    description: z.string().max(10000).default(""),
  }),
  z.object({ action: z.literal("module"), project_id: uuid, name }),
  z.object({
    action: z.literal("move_module"),
    id: uuid,
    module_id: uuid.nullable(),
  }),
  z.object({
    action: z.literal("delete_project"),
    id: uuid,
    confirmation: name,
  }),
  z.object({ action: z.literal("team"), name }),
  z.object({ action: z.literal("remove_member"), id: uuid, team_id: uuid }),
  z.object({ action: z.literal("delete_team"), id: uuid }),
  z.object({ action: z.literal("member"), name, team_id: uuid.nullable() }),
  z.object({
    action: z.literal("task"),
    project_id: uuid,
    module_id: uuid.nullable().default(null),
    title: name,
    description: z.string().max(10000).default(""),
    priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
  }),
  z.object({
    action: z.literal("edit"),
    id: uuid,
    title: name,
    description: z.string().max(10000),
    priority: z.enum(["Low", "Medium", "High"]),
  }),
  z.object({ action: z.literal("status"), id: uuid, status: z.enum(statuses) }),
  z.object({
    action: z.literal("assign"),
    id: uuid,
    member_id: uuid.nullable(),
    team_id: uuid.nullable(),
  }),
  z.object({
    action: z.literal("update"),
    id: uuid,
    message: z.string().trim().min(1).max(10000),
  }),
  z.object({
    action: z.literal("day"),
    id: uuid,
    day: z.iso.date(),
    included: z.boolean(),
  }),
]);
