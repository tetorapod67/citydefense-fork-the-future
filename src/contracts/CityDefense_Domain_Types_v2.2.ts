/* CityDefense: Fork the Future — domain contracts v2.2 */
export type P0RuntimeSeatRole = "OWNER" | "SENTINEL" | "PLANNER";
export type ExtendedSeatRole = P0RuntimeSeatRole | "DISPATCHER" | "OBSERVER"; // FUTURE_OPTIONAL / historical compatibility
export type SeatRole = ExtendedSeatRole;
export type BranchStatus = "RUNNING" | "PAUSED" | "ARCHIVED";
export type TimeScale = "NORMAL" | "DEMO" | "TEST";
export type WorldlineTheme = "CONVENTIONAL" | "SCIENCE_FICTION" | "FANTASY" | "MIXED";
export type VisibilityScope = "BRANCH_PUBLIC" | "SEAT_PRIVATE" | "OWNER_AUDIT" | "SYSTEM";
export type GraphRef = `${"tile"|"district"|"structure"|"unit"|"event"|"signal"|"stamp"|"relation"|"seat"|"branch"|"metric"}:${string}`;

export interface Coordinate { x: number; y: number; }
export interface TileState extends Coordinate {
  id: string;
  terrain: "PLAIN"|"MOUNTAIN"|"WATER"|"AVALANCHE_PATH"|"DAMAGED"|"SNOW"|"SF_SURFACE"|"FANTASY_SURFACE";
  district: string;
  elevation: number;
  buildable: boolean;
}
export interface StructureState extends Coordinate {
  id: string;
  typeId: string;
  condition: number;
  status: "ACTIVE"|"DISABLED"|"DAMAGED"|"DESTROYED"|"UNDER_CONSTRUCTION";
}
export interface MobileUnitState extends Coordinate {
  id: string;
  typeId: string;
  homeFacilityId: string;
  status: "READY"|"DISPATCHED"|"MOVING"|"WORKING"|"RETURNING"|"DAMAGED";
  condition: number;
  destinationRef?: GraphRef;
  route?: Coordinate[];
  etaTick?: number;
}
export interface CityMetrics {
  cash: number;
  population: number;
  happiness: number;
  powerReserve: number;
  shelterCapacity: number;
  casualties: number;
  defenseReadiness: number;
}
export interface ScenarioSignal {
  id: string;
  kind: string;
  tick: number;
  strength: number;
  confidence: number;
  trend: "STABLE"|"RISING"|"RAPIDLY_RISING"|"CRITICAL";
  districtRef?: GraphRef;
}
export interface StampQualifiers {
  urgency?: "LOW"|"NORMAL"|"HIGH"|"CRITICAL";
  confidence?: "LOW"|"MEDIUM"|"HIGH";
  timing?: "NOW"|"SOON"|"BEFORE_WAVE"|"AFTER_WAVE"|"UNTIL_SAFE";
  quantity?: number;
  expiresAtTick?: number;
}
export interface StampRecord {
  id: string;
  branchId: string;
  actorSeatId: string;
  actorRole: SeatRole;
  stampTypeId: string;
  targetRefs: GraphRef[];
  scope: VisibilityScope;
  qualifiers: StampQualifiers;
  createdAt: string;
  simulationTick: number;
  threadRootStampId: string;
  replyToStampId?: string;
  status: "ACTIVE"|"ACKNOWLEDGED"|"RESOLVED"|"SUPERSEDED"|"RETRACTED"|"EXPIRED";
  sourceToolCallId?: string;
}
export interface RelationRecord {
  id: string;
  branchId: string;
  actorSeatId: string;
  relationTypeId: string;
  sourceRef: GraphRef;
  targetRef: GraphRef;
  createdAt: string;
  simulationTick: number;
  status: "ACTIVE"|"SUPERSEDED"|"RETRACTED";
}
export interface BranchState {
  format: "CityDefenseBranchState/2.2";
  townId: string;
  branchId: string;
  branchName: string;
  branchStatus: BranchStatus;
  branchVersion: number;
  worldlineTheme: WorldlineTheme;
  timeScale: TimeScale;
  simulationTick: number;
  month: number;
  waveIndex: number;
  currentCrisis?: { id: string; type: string; phase: string; public: boolean };
  metrics: CityMetrics;
  tiles: TileState[];
  structures: StructureState[];
  mobileUnits: MobileUnitState[];
  stamps: StampRecord[];
  relations: RelationRecord[];
  unresolvedStampIds: string[];
  scenarioCursor: { waveIndex: number; signalIndex: number; scenarioSeed: number };
  runtimeRuleVersion: string;
  stampCatalogVersion: string;
}
export interface DomainEvent<TPayload=unknown> {
  eventId: string;
  branchId: string;
  serverSequence: number;
  serverTime: string;
  simulationTick: number;
  actorSeatId: string;
  actorRole: SeatRole|"SYSTEM";
  eventType: string;
  targetRefs: GraphRef[];
  payload: TPayload;
  requestId?: string;
  causationId?: string;
  correlationId?: string;
  branchVersionBefore: number;
  branchVersionAfter: number;
  stateAfter: BranchState;
}
export interface AccessTrace {
  traceId: string;
  branchId: string;
  seatId: string;
  role: SeatRole;
  toolName: string;
  requestedRefs: GraphRef[];
  returnedRefs: GraphRef[];
  returnedCursor?: string;
  createdAt: string;
  simulationTick: number;
  auditPayload?: Record<string, unknown>;
}

/* v2.1 expanded content catalog contracts */
export type ImplementationTier = "P0" | "P1" | "P2" | "P3";
export type ArtStatus = "PRODUCED" | "SPEC_ONLY";
export type CrisisFootprintModel =
  | "POINT" | "RADIUS" | "CORRIDOR" | "CONE" | "RIVER_PATH"
  | "COASTLINE" | "NETWORK" | "DISTRICT" | "CITYWIDE" | "MULTI_VECTOR";

export interface DamageRangeValue { min: number; max: number; }
export interface CrisisDamageRange {
  casualties: DamageRangeValue;
  structures: DamageRangeValue;
  infrastructureSegments: DamageRangeValue;
  cashLoss: DamageRangeValue;
}
export interface CrisisDefinitionV21 {
  id: string;
  category: string;
  displayNameJa: string;
  displayNameEn: string;
  implementationTier: ImplementationTier;
  baseSeverity: number;
  firstEligibleWave: number;
  visibilityModel: "PUBLIC_EARLY" | "AI_PRECURSOR_THEN_PUBLIC" | "AI_ONLY_UNTIL_IMPACT";
  footprintModel: CrisisFootprintModel;
  footprintDescriptionJa: string;
  warningWindowTicks: DamageRangeValue;
  precursorSignals: readonly string[];
  affectedSystems: readonly string[];
  directDamageRange: CrisisDamageRange;
  secondaryHazards: readonly string[];
  facilityCounters: readonly string[];
  unitCounters: readonly string[];
  terrainCounters: readonly string[];
  roadCounters: readonly string[];
  railCounters: readonly string[];
  responseSequenceJa: readonly string[];
  failureConsequencesJa: string;
  aiAssistanceReasonJa: string;
  branchComparisonValueJa: string;
  primaryAssetFamily: string;
  countermeasureTags: readonly string[];
  deterministicDemoCandidate: boolean;
  notes: string;
}

export interface ContentRegistryV21 {
  buildingsById: ReadonlyMap<string, unknown>;
  facilitiesById: ReadonlyMap<string, unknown>;
  mobileUnitsById: ReadonlyMap<string, unknown>;
  transitVehiclesById: ReadonlyMap<string, unknown>;
  terrainWorksById: ReadonlyMap<string, unknown>;
  roadsById: ReadonlyMap<string, unknown>;
  railsById: ReadonlyMap<string, unknown>;
  stationsById: ReadonlyMap<string, unknown>;
  crisesById: ReadonlyMap<string, CrisisDefinitionV21>;
}

export interface MitigationContribution {
  sourceRef: GraphRef;
  countermeasureTags: readonly string[];
  coverageRefs: readonly GraphRef[];
  effectiveness: number;
  operational: boolean;
  reasonCodes: readonly string[];
}
