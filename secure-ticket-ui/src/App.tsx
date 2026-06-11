import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "./api";
import type {
  CreateTicketInput,
  Ticket,
  TicketSeverity,
  TicketStatus
} from "./types";

type ApiState = "checking" | "online" | "offline";

const DEMO_EMAIL = "analyst@aegiscore.example";
const DEMO_PASSWORD = "demo-password";
const TOKEN_KEY = "secure-ticket-token";

const emptyTicket: CreateTicketInput = {
  title: "",
  system: "",
  severity: "MEDIUM",
  description: ""
};

const severityRank: Record<TicketSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const statusLabel = (status: TicketStatus) => status.replace("_", " ");

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);
};

export const App = () => {
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginBusy, setIsLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTicket, setNewTicket] = useState<CreateTicketInput>(emptyTicket);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editStatus, setEditStatus] = useState<TicketStatus>("OPEN");
  const [editAssignee, setEditAssignee] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const loadTickets = async (authToken: string) => {
    setIsLoading(true);
    setPageError("");
    const result = await api.tickets(authToken);
    setIsLoading(false);

    if (!result.ok) {
      if (result.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
      }
      setPageError(result.message);
      return;
    }

    setTickets(result.data.tickets);
    setActiveTicketId((current) => {
      const exists = result.data.tickets.some((ticket) => ticket.id === current);
      return exists ? current : (result.data.tickets[0]?.id ?? "");
    });
  };

  useEffect(() => {
    void api.health().then((result) => setApiState(result.ok ? "online" : "offline"));
  }, []);

  useEffect(() => {
    if (token) {
      void loadTickets(token);
    }
  }, [token]);

  const filteredTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => statusFilter === "ALL" || ticket.status === statusFilter)
        .filter((ticket) => {
          const searchable = [
            ticket.id,
            ticket.title,
            ticket.system,
            ticket.createdBy,
            ticket.assignedTo
          ]
            .join(" ")
            .toLowerCase();
          return searchable.includes(query.trim().toLowerCase());
        })
        .sort(
          (left, right) =>
            severityRank[right.severity] - severityRank[left.severity]
        ),
    [query, statusFilter, tickets]
  );

  const activeTicket =
    tickets.find((ticket) => ticket.id === activeTicketId) ??
    filteredTickets[0] ??
    null;

  useEffect(() => {
    if (!activeTicket) {
      return;
    }
    setEditStatus(activeTicket.status);
    setEditAssignee(activeTicket.assignedTo);
  }, [activeTicket]);

  const metrics = useMemo(
    () => ({
      active: tickets.filter((ticket) =>
        ["OPEN", "IN_PROGRESS"].includes(ticket.status)
      ).length,
      critical: tickets.filter(
        (ticket) =>
          ticket.severity === "CRITICAL" &&
          !["RESOLVED", "CLOSED"].includes(ticket.status)
      ).length,
      unassigned: tickets.filter((ticket) => ticket.assignedTo === "Unassigned")
        .length,
      resolved: tickets.filter((ticket) =>
        ["RESOLVED", "CLOSED"].includes(ticket.status)
      ).length
    }),
    [tickets]
  );

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setIsLoginBusy(true);
    const result = await api.login(email.trim(), password);
    setIsLoginBusy(false);

    if (!result.ok) {
      setLoginError(result.message);
      return;
    }

    sessionStorage.setItem(TOKEN_KEY, result.data.token);
    setToken(result.data.token);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTickets([]);
    setActiveTicketId("");
    setPageError("");
    setNotice("");
  };

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");

    const input = {
      ...newTicket,
      title: newTicket.title.trim(),
      system: newTicket.system.trim(),
      description: newTicket.description.trim()
    };

    if (!input.title || !input.system || !input.description) {
      setCreateError("Title, system, and description are required.");
      return;
    }

    setIsCreating(true);
    const result = await api.createTicket(token, input);
    setIsCreating(false);

    if (!result.ok) {
      setCreateError(result.message);
      return;
    }

    setTickets((current) => [result.data.ticket, ...current]);
    setActiveTicketId(result.data.ticket.id);
    setNewTicket(emptyTicket);
    setIsCreateOpen(false);
    setNotice(`${result.data.ticket.id} created and added to the incident queue.`);
  };

  const handleUpdateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTicket) {
      return;
    }

    const assignedTo = editAssignee.trim();
    if (!assignedTo) {
      setPageError("Assignee cannot be empty.");
      return;
    }

    setIsUpdating(true);
    setPageError("");
    const result = await api.updateTicket(token, activeTicket.id, {
      status: editStatus,
      assignedTo
    });
    setIsUpdating(false);

    if (!result.ok) {
      setPageError(result.message);
      return;
    }

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === result.data.ticket.id ? result.data.ticket : ticket
      )
    );
    setNotice(`${result.data.ticket.id} updated successfully.`);
  };

  if (!token) {
    return (
      <main className="loginShell">
        <section className="loginPanel">
          <div className="loginBrand">
            <LogoMark />
            <div>
              <strong>AegisCore</strong>
              <span>Enterprise Service Operations</span>
            </div>
          </div>
          <div className="loginCopy">
            <p className="eyebrow">Secure operations workspace</p>
            <h1>Manage incidents with one accountable workflow.</h1>
            <p>
              Triage requests, track ownership, and maintain an auditable view of
              operational work.
            </p>
          </div>
          <div className="loginStatus">
            <span className={`statusDot ${apiState}`} />
            {apiState === "checking"
              ? "Checking service availability"
              : apiState === "online"
                ? "Ticket API is online"
                : "Ticket API is unavailable"}
          </div>
        </section>

        <section className="loginCard">
          <p className="eyebrow">Analyst access</p>
          <h2>Sign in to the console</h2>
          <p className="muted">
            Demo credentials are prefilled for the local development environment.
          </p>
          <form onSubmit={handleLogin}>
            <label>
              Work email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {loginError && <div className="inlineMessage error">{loginError}</div>}
            <button className="primaryButton loginButton" disabled={isLoginBusy}>
              {isLoginBusy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brandBlock">
          <LogoMark />
          <div>
            <div className="brand">AegisCore</div>
            <div className="brandSub">Service Operations</div>
          </div>
        </div>

        <nav className="navStack" aria-label="Primary navigation">
          <button className="navItem active">
            <Icon symbol="T" />
            <span>Incident queue</span>
          </button>
          <button className="navItem" disabled title="Planned module">
            <Icon symbol="S" />
            <span>Service catalog</span>
          </button>
          <button className="navItem" disabled title="Planned module">
            <Icon symbol="R" />
            <span>Reports</span>
          </button>
        </nav>

        <div className="environmentCard">
          <span>Environment</span>
          <strong>Local development</strong>
          <small>Tickets reset when the API restarts</small>
        </div>

        <section className="sessionPanel">
          <div className="avatar">NA</div>
          <div className="sessionText">
            <span>NOC Analyst</span>
            <small>{DEMO_EMAIL}</small>
          </div>
          <button className="textButton" onClick={handleLogout}>
            Sign out
          </button>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Enterprise incident management</p>
            <h1>Ticket Operations</h1>
            <p className="headerSummary">
              Monitor active work, maintain ownership, and resolve service impact.
            </p>
          </div>
          <div className="topActions">
            <div className={`apiPill ${apiState}`}>
              <span />
              {apiState === "online" ? "API online" : "API offline"}
            </div>
            <button
              className="ghostButton"
              onClick={() => void loadTickets(token)}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button className="primaryButton" onClick={() => setIsCreateOpen(true)}>
              <span aria-hidden="true">+</span>
              New ticket
            </button>
          </div>
        </header>

        {(pageError || notice) && (
          <div className={`inlineMessage ${pageError ? "error" : "success"}`}>
            {pageError || notice}
            <button
              aria-label="Dismiss message"
              onClick={() => {
                setPageError("");
                setNotice("");
              }}
            >
              ×
            </button>
          </div>
        )}

        <section className="metricsGrid" aria-label="Ticket metrics">
          <Metric label="Active incidents" value={metrics.active} detail="Open and in progress" tone="blue" />
          <Metric label="Critical exposure" value={metrics.critical} detail="Requires immediate attention" tone="red" />
          <Metric label="Unassigned" value={metrics.unassigned} detail="Awaiting queue ownership" tone="amber" />
          <Metric label="Resolved" value={metrics.resolved} detail="Completed in this session" tone="green" />
        </section>

        <section className="operationsGrid">
          <section className="queuePanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Operations queue</p>
                <h2>Incidents</h2>
                <p>{filteredTickets.length} of {tickets.length} tickets shown</p>
              </div>
            </div>

            <div className="toolbar">
              <label className="searchBox">
                <span aria-hidden="true">⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ID, title, system, or owner"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as TicketStatus | "ALL")
                }
                aria-label="Filter by status"
              >
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div className="ticketList">
              {isLoading ? (
                <EmptyState title="Loading incidents..." detail="Retrieving the current queue from the API." />
              ) : filteredTickets.length ? (
                filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className={`ticketRow ${ticket.id === activeTicket?.id ? "selected" : ""}`}
                    onClick={() => setActiveTicketId(ticket.id)}
                  >
                    <span className={`severity ${ticket.severity.toLowerCase()}`}>
                      {ticket.severity}
                    </span>
                    <span className="ticketMain">
                      <strong>{ticket.title}</strong>
                      <small>{ticket.id} · {ticket.system}</small>
                    </span>
                    <span className="ticketMeta">
                      <span className={`statusBadge ${ticket.status.toLowerCase()}`}>
                        {statusLabel(ticket.status)}
                      </span>
                      <small>{ticket.assignedTo}</small>
                    </span>
                  </button>
                ))
              ) : (
                <EmptyState
                  title="No matching incidents"
                  detail="Adjust the search or status filter to view more tickets."
                />
              )}
            </div>
          </section>

          <aside className="detailPanel">
            {activeTicket ? (
              <>
                <div className="detailTop">
                  <span className={`severity ${activeTicket.severity.toLowerCase()}`}>
                    {activeTicket.severity}
                  </span>
                  <span className={`statusBadge ${activeTicket.status.toLowerCase()}`}>
                    {statusLabel(activeTicket.status)}
                  </span>
                </div>
                <p className="ticketNumber">{activeTicket.id}</p>
                <h2>{activeTicket.title}</h2>
                <p className="ticketDescription">{activeTicket.description}</p>

                <dl className="details">
                  <div>
                    <dt>Affected system</dt>
                    <dd>{activeTicket.system}</dd>
                  </div>
                  <div>
                    <dt>Requester</dt>
                    <dd>{activeTicket.createdBy}</dd>
                  </div>
                  <div>
                    <dt>Current owner</dt>
                    <dd>{activeTicket.assignedTo}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{formatUpdatedAt(activeTicket.updatedAt)}</dd>
                  </div>
                </dl>

                <form className="updateForm" onSubmit={handleUpdateTicket}>
                  <div className="formSectionHeader">
                    <div>
                      <h3>Workflow controls</h3>
                      <p>Update ownership and lifecycle status.</p>
                    </div>
                  </div>
                  <label>
                    Status
                    <select
                      value={editStatus}
                      onChange={(event) =>
                        setEditStatus(event.target.value as TicketStatus)
                      }
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </label>
                  <label>
                    Assigned team or analyst
                    <input
                      value={editAssignee}
                      onChange={(event) => setEditAssignee(event.target.value)}
                      placeholder="Unassigned"
                    />
                  </label>
                  <button className="primaryButton" disabled={isUpdating}>
                    {isUpdating ? "Saving changes..." : "Save changes"}
                  </button>
                </form>

                <section className="auditPanel">
                  <h3>Audit context</h3>
                  <div className="auditItem">
                    <span />
                    <div>
                      <strong>Ticket record loaded</strong>
                      <p>Current API state is displayed in this workspace.</p>
                    </div>
                  </div>
                  <div className="auditItem">
                    <span />
                    <div>
                      <strong>Request tracing enabled</strong>
                      <p>API responses include an X-Request-Id for server logs.</p>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <EmptyState
                title="Select an incident"
                detail="Choose a ticket from the queue to review its operational details."
              />
            )}
          </aside>
        </section>
      </section>

      {isCreateOpen && (
        <div
          className="modalOverlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setIsCreateOpen(false);
            }
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
            <header className="modalHeader">
              <div>
                <p className="eyebrow">Incident intake</p>
                <h2 id="create-title">Create a new ticket</h2>
                <p>Capture enough context for fast triage and assignment.</p>
              </div>
              <button
                className="modalClose"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close create ticket dialog"
              >
                ×
              </button>
            </header>
            <form onSubmit={handleCreateTicket}>
              <div className="modalBody">
                <label>
                  Ticket title
                  <input
                    value={newTicket.title}
                    onChange={(event) =>
                      setNewTicket((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Briefly summarize the issue"
                    autoFocus
                  />
                </label>
                <div className="formGrid">
                  <label>
                    Affected system
                    <input
                      value={newTicket.system}
                      onChange={(event) =>
                        setNewTicket((current) => ({ ...current, system: event.target.value }))
                      }
                      placeholder="Example: Identity Service"
                    />
                  </label>
                  <label>
                    Severity
                    <select
                      value={newTicket.severity}
                      onChange={(event) =>
                        setNewTicket((current) => ({
                          ...current,
                          severity: event.target.value as TicketSeverity
                        }))
                      }
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    value={newTicket.description}
                    onChange={(event) =>
                      setNewTicket((current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                    placeholder="Describe the symptoms, scope, and business impact"
                    rows={6}
                  />
                </label>
                {createError && <div className="inlineMessage error">{createError}</div>}
              </div>
              <footer className="modalFooter">
                <button
                  type="button"
                  className="ghostButton"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button className="primaryButton" disabled={isCreating}>
                  {isCreating ? "Creating ticket..." : "Create ticket"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
};

const LogoMark = () => (
  <div className="brandMark" aria-hidden="true">
    <span>A</span>
  </div>
);

const Icon = ({ symbol }: { symbol: string }) => (
  <span className="navIcon" aria-hidden="true">{symbol}</span>
);

const Metric = ({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: number;
  detail: string;
  tone: "blue" | "red" | "amber" | "green";
}) => (
  <article className={`metric ${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>
);

const EmptyState = ({
  title,
  detail
}: {
  title: string;
  detail: string;
}) => (
  <div className="emptyState">
    <div aria-hidden="true">—</div>
    <strong>{title}</strong>
    <p>{detail}</p>
  </div>
);
