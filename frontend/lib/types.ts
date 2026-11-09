export type ProjectStatus = "active" | "review" | "paused" | "completed";
export type MilestoneStatus = "done" | "in_progress" | "upcoming" | "blocked";
export type ReviewState = "potential" | "reviewing" | "accepted" | "dismissed";
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "failed"
  | "refunded"
  | "unsynced";
export type LeadStage = "new" | "contacted" | "qualified" | "proposal" | "won";
export type ActionStatus =
  | "draft"
  | "pending_approval"
  | "executing"
  | "succeeded"
  | "rejected"
  | "failed";

export type Source = {
  kind: string;
  label: string;
  id: string;
  checkedAt: string;
};

export type Client = {
  id: string;
  name: string;
  company: string;
  email: string;
  initials: string;
  hue: "orange" | "stone" | "yellow" | "ink";
};

export type Milestone = {
  id: string;
  projectId: string;
  title: string;
  dueAt: string;
  status: MilestoneStatus;
  value: number;
  acceptance: string;
};

export type ScopeClause = {
  id: string;
  label: string;
  text: string;
  kind: "included" | "excluded";
};

export type ScopeFinding = {
  id: string;
  projectId: string;
  title: string;
  message: string;
  sender: string;
  platform: "Telegram" | "Uploaded chat" | "Email";
  receivedAt: string;
  clauseId: string;
  classification: "potential_change" | "within_scope" | "insufficient_context";
  rationale: string;
  confidence: number;
  estimate: number;
  reviewState: ReviewState;
  messageId: string;
};

export type ClientMessage = {
  id: string;
  projectId: string;
  platform: "Telegram" | "Uploaded chat" | "Email";
  sender: string;
  senderRole: "client" | "freelancer";
  text: string;
  sentAt: string;
  consent: string;
};

export type Project = {
  id: string;
  clientId: string;
  name: string;
  codename: string;
  status: ProjectStatus;
  description: string;
  currency: string;
  budget: number;
  paid: number;
  dueAt: string;
  progress: number;
  health: "on_track" | "at_risk" | "blocked";
  nextDeadlineId: string;
};

export type Agreement = {
  projectId: string;
  version: string;
  effectiveAt: string;
  file: string;
  clauses: ScopeClause[];
};

export type Invoice = {
  id: string;
  number: string;
  projectId: string;
  clientId: string;
  amount: number;
  amountPaid: number;
  currency: string;
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
  provider: "PayPal Sandbox";
  providerId: string;
  lastVerifiedAt: string | null;
  note: string;
};

export type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  source: string;
  stage: LeadStage;
  receivedAt: string;
  interest: string;
  nextAction: string;
  nextActionAt: string;
  value: number;
};

export type Report = {
  id: string;
  title: string;
  projectId: string;
  clientId: string;
  period: string;
  createdAt: string;
  status: "draft" | "sent" | "failed";
  pages: number;
  summary: string;
  providerMessageId?: string;
  simulated?: boolean;
};

export type ActivityEvent = {
  id: string;
  type:
    | "scope"
    | "payment"
    | "email"
    | "report"
    | "tool"
    | "approval"
    | "integration"
    | "ingest"
    | "system";
  actor: "Visun" | "You" | "PayPal" | "Telegram" | "Gmail";
  title: string;
  detail: string;
  at: string;
  status: "info" | "success" | "pending" | "failed";
  reference?: string;
  projectId?: string;
};

export type ToolCall = {
  id: string;
  name: string;
  args: string;
  status: "running" | "done" | "failed";
  duration: string;
  result: string;
};

export type ProposedAction = {
  id: string;
  kind:
    | "email"
    | "payment_request"
    | "report"
    | "calendar"
    | "agreement_change";
  title: string;
  recipient: string;
  subject: string;
  body: string;
  amount?: number;
  currency?: string;
  provider: string;
  status: ActionStatus;
  createdAt: string;
  expiresAt?: string;
  providerId?: string;
  simulated?: boolean;
  canonicalHash?: string;
  error?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  modality: "text" | "voice";
  text: string;
  at: string;
  sources?: Source[];
  tools?: ToolCall[];
  action?: ProposedAction;
  streaming?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type Integration = {
  id: string;
  name: string;
  description: string;
  env: string;
  scopes: string[];
  connected: boolean;
  lastSync: string | null;
  tone: "orange" | "ink" | "stone" | "yellow";
};

export type Preferences = {
  voiceReplies: boolean;
  saveTranscripts: boolean;
  reducedMotion: boolean;
  dailyBrief: boolean;
  timezone: string;
  retention: "30" | "90" | "365" | "forever";
};

export type WorkspaceReference = {
  clients: Client[];
  projects: Project[];
  milestones: Milestone[];
  agreements: Agreement[];
  invoices: Invoice[];
  scopeFindings: ScopeFinding[];
  messages: ClientMessage[];
  integrations: Integration[];
};

export type AppState = {
  version: number;
  /** The signed-in workspace's records. Empty for a brand-new account. */
  reference: WorkspaceReference;
  findingReviews: Record<string, ReviewState>;
  actions: Record<string, ActionStatus>;
  integrations: Record<string, boolean>;
  leads: Lead[];
  reports: Report[];
  conversations: Conversation[];
  activities: ActivityEvent[];
  doneMilestones: string[];
  preferences: Preferences;
};
