/**
 * CityDefense: Fork the Future — WebMCP tool contracts v2.2
 *
 * Intended destination:
 *   src/features/webmcp/toolContracts.ts
 *
 * Requirements:
 * - Register from the top-level /play page after authentication.
 * - Register only tools authorized for the current Seat.
 * - Abort all registrations on logout, Seat change, Branch change, or route exit.
 * - All server routes re-authenticate and re-authorize. Tool visibility is not security.
 * - GUI commands and WebMCP commands call the same server command service.
 */

export type P0RuntimeSeatRole = "OWNER" | "SENTINEL" | "PLANNER";
export type ExtendedSeatRole = P0RuntimeSeatRole | "DISPATCHER" | "OBSERVER"; // FUTURE_OPTIONAL; never registered by P0
export type SeatRole = ExtendedSeatRole;
export type WebMcpStatus = "UNAVAILABLE" | "REGISTERING" | "READY" | "ERROR";

export type ToolFailure = {
  ok: false;
  tool: string;
  code: string;
  message: string;
  branch_version?: number;
  refresh_required?: boolean;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export type ToolSuccess<T> = {
  ok: true;
  tool: string;
  branch_id: string;
  branch_version: number;
  simulation_tick: number;
  month: number;
  data: T;
  event_id?: string;
  next_cursor?: string;
  idempotent_replay?: boolean;
};

export type ToolResult<T> = ToolSuccess<T> | ToolFailure;

export interface CityDefenseApiClient {
  get<T>(path: string, signal?: AbortSignal): Promise<ToolResult<T>>;
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<ToolResult<T>>;
}

export interface ToolRuntimeContext {
  role: P0RuntimeSeatRole;
  seatId: string;
  branchId: string;
  api: CityDefenseApiClient;
  setStatus(status: WebMcpStatus): void;
  onToolSuccess(result: ToolSuccess<unknown>): void;
  onToolFailure(result: ToolFailure): void;
}

type ToolExecutionOptions = { signal?: AbortSignal };
type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};
type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute: (args: Record<string, unknown>, options?: ToolExecutionOptions) => Promise<unknown>;
};
type ModelContextLike = {
  registerTool(tool: ToolDefinition, options?: { signal?: AbortSignal }): Promise<void> | void;
};
type WebMcpDocument = Document & { modelContext?: ModelContextLike };

const objectSchema = <T extends Record<string, unknown>>(
  properties: T,
  required: Array<keyof T & string>,
) => ({ type: "object", properties, required, additionalProperties: false } as const);

function notify<T>(ctx: ToolRuntimeContext, result: ToolResult<T>): ToolResult<T> {
  if (result.ok) ctx.onToolSuccess(result as ToolSuccess<unknown>);
  else ctx.onToolFailure(result);
  return result;
}

function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  return search.size ? `?${search.toString()}` : "";
}

const readAnnotations = { readOnlyHint: true, untrustedContentHint: true } as const;

const getCityContext = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "get_city_context",
  description:
    "Read the authenticated Seat, active Branch, city metrics, current crisis phase, permitted actions, unresolved public stamps, assigned units, and recent Seat continuity. Does not change state.",
  inputSchema: objectSchema({
    detail: { type: "string", enum: ["SUMMARY", "OPERATIONAL", "FULL_VISIBLE"] },
    include_unresolved_stamps: { type: "boolean" },
    include_assigned_units: { type: "boolean" },
  }, ["detail"]),
  annotations: readAnnotations,
  execute: async (args, options) => notify(ctx, await ctx.api.get(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/context${query(args)}`,
    options?.signal,
  )),
});

const inspectObject = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "inspect_object",
  description:
    "Read one visible tile, district, structure, mobile unit, event, stamp, relation, branch, or authorized signal by stable reference. The response includes compact nearby facts and recent linked activity.",
  inputSchema: objectSchema({
    target_ref: { type: "string", minLength: 3, maxLength: 160 },
    nearby_radius: { type: "integer", minimum: 0, maximum: 3 },
    history_limit: { type: "integer", minimum: 0, maximum: 12 },
  }, ["target_ref"]),
  annotations: readAnnotations,
  execute: async (args, options) => notify(ctx, await ctx.api.get(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/objects/${encodeURIComponent(String(args.target_ref))}${query({ nearbyRadius: args.nearby_radius, historyLimit: args.history_limit })}`,
    options?.signal,
  )),
});

const getRecentActivity = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "get_recent_activity",
  description:
    "Read a compact chronological activity window containing game actions, public stamps, stamp replies, typed relations, unit dispatches, crisis events, and system results. This is the chat-like branch feed; it contains no arbitrary user-authored public text.",
  inputSchema: objectSchema({
    cursor: { type: "string", maxLength: 240 },
    actor: { type: "string", enum: ["ALL", "OWNER", "SENTINEL", "PLANNER", "SYSTEM"] },
    kind: { type: "string", enum: ["ALL", "ACTION", "STAMP", "RELATION", "UNIT", "CRISIS", "SYSTEM"] },
    target_ref: { type: "string", maxLength: 160 },
    limit: { type: "integer", minimum: 1, maximum: 30 },
  }, ["limit"]),
  annotations: readAnnotations,
  execute: async (args, options) => notify(ctx, await ctx.api.get(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/activity${query(args)}`,
    options?.signal,
  )),
});

const searchStampCatalog = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "search_stamp_catalog",
  description:
    "Search the predefined semantic stamp vocabulary by intent, category, target kind, or exact ID. The private search query is not posted into the game world. Returns canonical IDs and usage constraints.",
  inputSchema: objectSchema({
    semantic_query: { type: "string", minLength: 1, maxLength: 160 },
    category: { type: "string", enum: ["ANY", "BASIC_STATUS", "EMOTION", "OBSERVATION", "INTENT_ACTION", "COORDINATION", "EVALUATION", "MEMORY_PROVENANCE", "TIME_MODIFIER"] },
    target_kind: { type: "string", enum: ["ANY", "TILE", "AREA", "STRUCTURE", "UNIT", "EVENT", "SIGNAL", "STAMP", "RELATION", "SEAT", "BRANCH", "METRIC"] },
    limit: { type: "integer", minimum: 1, maximum: 12 },
  }, ["semantic_query", "limit"]),
  annotations: { readOnlyHint: true },
  execute: async (args, options) => notify(ctx, await ctx.api.get(
    `/api/stamps/catalog/search${query(args)}`,
    options?.signal,
  )),
});

const getStampThread = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "get_stamp_thread",
  description:
    "Read the reply tree and typed relation subgraph rooted at a stamp. Returns system-rendered phrases, actor Seats, targets, acknowledgements, actions that responded, and unresolved edges.",
  inputSchema: objectSchema({
    root_stamp_id: { type: "string", minLength: 3, maxLength: 120 },
    depth: { type: "integer", minimum: 1, maximum: 4 },
    max_items: { type: "integer", minimum: 1, maximum: 40 },
  }, ["root_stamp_id"]),
  annotations: readAnnotations,
  execute: async (args, options) => notify(ctx, await ctx.api.get(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/stamps/${encodeURIComponent(String(args.root_stamp_id))}/thread${query({ depth: args.depth, maxItems: args.max_items })}`,
    options?.signal,
  )),
});

const getPrecursorSignals = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "get_precursor_signals",
  description:
    "SENTINEL-only read of machine-readable precursor telemetry currently available in the active Branch. Returns observations such as trends, confidence, strength, and stable district references, not a guaranteed crisis answer.",
  inputSchema: objectSchema({
    since_cursor: { type: "string", maxLength: 240 },
    minimum_strength: { type: "number", minimum: 0, maximum: 1 },
    include_previously_seen: { type: "boolean" },
    limit: { type: "integer", minimum: 1, maximum: 12 },
  }, ["limit"]),
  annotations: { readOnlyHint: true },
  execute: async (args, options) => notify(ctx, await ctx.api.get(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/signals${query(args)}`,
    options?.signal,
  )),
});

const buildCityAsset = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "build_city_asset",
  description:
    "PLANNER or OWNER command to place one authorized rail, station, road, building, or land-work catalog item. The server validates cost, footprint, terrain, connectivity, Branch version, and Seat permission before creating exactly one event.",
  inputSchema: objectSchema({
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    catalog_id: { type: "string", minLength: 3, maxLength: 120 },
    origin_x: { type: "integer", minimum: 0, maximum: 63 },
    origin_y: { type: "integer", minimum: 0, maximum: 63 },
    orientation: { type: "string", enum: ["NE", "SE", "SW", "NW"] },
    path: { type: "array", maxItems: 40, items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false } },
  }, ["request_id", "expected_branch_version", "catalog_id", "origin_x", "origin_y"]),
  execute: async (args, options) => notify(ctx, await ctx.api.post(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/commands/build-city-asset`, args, options?.signal,
  )),
});

const constructDefenseFacility = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "construct_defense_facility",
  description:
    "PLANNER or OWNER command to construct one defense facility from the authorized catalog. Validates terrain, threat path, home-network requirements, cash, and Branch version.",
  inputSchema: objectSchema({
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    facility_type_id: { type: "string", minLength: 3, maxLength: 120 },
    origin_x: { type: "integer", minimum: 0, maximum: 63 },
    origin_y: { type: "integer", minimum: 0, maximum: 63 },
    orientation: { type: "string", enum: ["NE", "SE", "SW", "NW"] },
    linked_threat_ref: { type: "string", maxLength: 160 },
  }, ["request_id", "expected_branch_version", "facility_type_id", "origin_x", "origin_y"]),
  execute: async (args, options) => notify(ctx, await ctx.api.post(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/commands/construct-defense-facility`, args, options?.signal,
  )),
});

const purchaseMobileUnit = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "purchase_mobile_unit",
  description:
    "PLANNER or OWNER command to purchase one cataloged mobile defense unit into a compatible facility with an available slot. Does not dispatch the unit.",
  inputSchema: objectSchema({
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    unit_type_id: { type: "string", minLength: 3, maxLength: 120 },
    home_facility_id: { type: "string", minLength: 3, maxLength: 120 },
  }, ["request_id", "expected_branch_version", "unit_type_id", "home_facility_id"]),
  execute: async (args, options) => notify(ctx, await ctx.api.post(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/commands/purchase-mobile-unit`, args, options?.signal,
  )),
});

const dispatchMobileUnit = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "dispatch_mobile_unit",
  description:
    "PLANNER or OWNER command to send one ready mobile unit to a stable target reference for one allowed mission. The server computes a route and ETA, reserves the unit, and records the command as a replayable event.",
  inputSchema: objectSchema({
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    unit_id: { type: "string", minLength: 3, maxLength: 120 },
    mission: { type: "string", enum: ["RECON", "FIRE_RESPONSE", "EVACUATE", "RESCUE", "REPAIR", "SUPPLY", "INTERCEPT", "SHELTER", "RETURN_HOME"] },
    target_ref: { type: "string", minLength: 3, maxLength: 160 },
    supporting_stamp_id: { type: "string", maxLength: 120 },
  }, ["request_id", "expected_branch_version", "unit_id", "mission", "target_ref"]),
  execute: async (args, options) => notify(ctx, await ctx.api.post(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/commands/dispatch-mobile-unit`, args, options?.signal,
  )),
});

const setTransportService = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "set_transport_service",
  description:
    "PLANNER or OWNER command to set a simplified rail or road service policy. This is not a free-form timetable editor: choose a bounded service level and emergency priority.",
  inputSchema: objectSchema({
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    route_id: { type: "string", minLength: 3, maxLength: 120 },
    service_level: { type: "string", enum: ["SUSPENDED", "SPARSE", "STANDARD", "FREQUENT"] },
    emergency_priority: { type: "string", enum: ["NORMAL", "PASSENGER_EVACUATION", "DEFENSE_LOGISTICS"] },
  }, ["request_id", "expected_branch_version", "route_id", "service_level", "emergency_priority"]),
  execute: async (args, options) => notify(ctx, await ctx.api.post(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/commands/set-transport-service`, args, options?.signal,
  )),
});

const setEvacuationOrder = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "set_evacuation_order",
  description:
    "SENTINEL, PLANNER, or OWNER evacuation command. SENTINEL is limited to PREPARE; PLANNER and OWNER may create, activate, change, or cancel. The server enforces mode and validates shelter capacity and reachable transport.",
  inputSchema: objectSchema({
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    district_id: { type: "string", minLength: 3, maxLength: 120 },
    mode: { type: "string", enum: ["PREPARE", "ACTIVATE", "CANCEL"] },
    destination_facility_ids: { type: "array", maxItems: 8, items: { type: "string", minLength: 3, maxLength: 120 } },
    supporting_stamp_id: { type: "string", maxLength: 120 },
  }, ["request_id", "expected_branch_version", "district_id", "mode"]),
  execute: async (args, options) => notify(ctx, await ctx.api.post(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/commands/set-evacuation-order`, args, options?.signal,
  )),
});

const placeStampBundle = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "place_stamp_bundle",
  description:
    "Place one canonical core stamp on one or more stable world references, with bounded urgency, confidence, timing, optional reply linkage, and up to three canonical modifier stamps. This creates a public or Seat-private semantic act, not arbitrary text.",
  inputSchema: objectSchema({
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    core_stamp_type_id: { type: "string", minLength: 3, maxLength: 120 },
    modifier_stamp_type_ids: { type: "array", maxItems: 3, uniqueItems: true, items: { type: "string", minLength: 3, maxLength: 120 } },
    target_refs: { type: "array", minItems: 1, maxItems: 4, uniqueItems: true, items: { type: "string", minLength: 3, maxLength: 160 } },
    scope: { type: "string", enum: ["BRANCH_PUBLIC", "SEAT_PRIVATE"] },
    urgency: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"] },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    reply_to_stamp_id: { type: "string", maxLength: 120 },
    expires_after_ticks: { type: "integer", minimum: 0, maximum: 200 },
  }, ["request_id", "expected_branch_version", "core_stamp_type_id", "target_refs", "scope"]),
  execute: async (args, options) => notify(ctx, await ctx.api.post(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/commands/place-stamp-bundle`, args, options?.signal,
  )),
});

const connectGraphItems = (ctx: ToolRuntimeContext): ToolDefinition => ({
  name: "connect_graph_items",
  description:
    "Create one typed relation between two existing Branch graph references. Relations are replayable first-class graph items and may themselves be referenced by later stamps or relations.",
  inputSchema: objectSchema({
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    source_ref: { type: "string", minLength: 3, maxLength: 160 },
    relation_type_id: { type: "string", minLength: 3, maxLength: 120 },
    target_ref: { type: "string", minLength: 3, maxLength: 160 },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
  }, ["request_id", "expected_branch_version", "source_ref", "relation_type_id", "target_ref"]),
  execute: async (args, options) => notify(ctx, await ctx.api.post(
    `/api/branches/${encodeURIComponent(ctx.branchId)}/commands/connect-graph-items`, args, options?.signal,
  )),
});

const BASE_READS = [getCityContext, inspectObject, getRecentActivity, searchStampCatalog, getStampThread];
const ROLE_TOOLS: Record<P0RuntimeSeatRole, Array<(ctx: ToolRuntimeContext) => ToolDefinition>> = {
  OWNER: [...BASE_READS, buildCityAsset, constructDefenseFacility, purchaseMobileUnit, dispatchMobileUnit, setTransportService, setEvacuationOrder, placeStampBundle, connectGraphItems],
  SENTINEL: [...BASE_READS, getPrecursorSignals, setEvacuationOrder, placeStampBundle, connectGraphItems],
  PLANNER: [...BASE_READS, buildCityAsset, constructDefenseFacility, purchaseMobileUnit, dispatchMobileUnit, setTransportService, setEvacuationOrder, placeStampBundle, connectGraphItems],
};

export async function registerCityDefenseTools(ctx: ToolRuntimeContext): Promise<AbortController | null> {
  const modelContext = (document as WebMcpDocument).modelContext;
  if (!modelContext) {
    ctx.setStatus("UNAVAILABLE");
    return null;
  }
  ctx.setStatus("REGISTERING");
  const controller = new AbortController();
  try {
    for (const factory of ROLE_TOOLS[ctx.role]) {
      await modelContext.registerTool(factory(ctx), { signal: controller.signal });
    }
    ctx.setStatus("READY");
    return controller;
  } catch (error) {
    controller.abort();
    ctx.setStatus("ERROR");
    throw error;
  }
}
