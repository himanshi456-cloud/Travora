import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  Activity, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert,
  ClipboardList, Compass, FileText, Filter, LayoutDashboard, LoaderCircle, MapPin, Plus,
  RefreshCw, Search, SlidersHorizontal, X, Plane, Hotel, Ticket, Car, Ship, ShieldCheck,
  Globe2, WalletCards, LogOut, Users, UserPlus, MessageSquare, Send, Inbox,
} from "lucide-react";
import { api, getAuthToken, setAuthToken } from "./api";
import type { AppRole, AppUser, BookingRow, BookingStatus, CustomerOption, DashboardSummary, Handler, RefundStatus, ServiceAssignment, ServiceBooking, ServiceType, SupportRequest, SupportStatus, TeamUser, Trip, TripStatus } from "./types";

const serviceOrder: ServiceType[] = ["FLIGHTS", "STAYS", "ACTIVITIES", "TRANSFERS", "FERRY", "VISA", "TOURIST_TAX", "ARRIVAL_CARD", "TRAVEL_INSURANCE"];
const serviceNames: Record<ServiceType, string> = {
  FLIGHTS: "Flights", STAYS: "Stays", ACTIVITIES: "Activities", TRANSFERS: "Transfers", FERRY: "Ferry",
  VISA: "Visa", TOURIST_TAX: "Tourist tax", ARRIVAL_CARD: "Arrival card", TRAVEL_INSURANCE: "Travel insurance",
};
const serviceIcons: Record<ServiceType, typeof Plane> = {
  FLIGHTS: Plane, STAYS: Hotel, ACTIVITIES: Ticket, TRANSFERS: Car, FERRY: Ship,
  VISA: Globe2, TOURIST_TAX: WalletCards, ARRIVAL_CARD: FileText, TRAVEL_INSURANCE: ShieldCheck,
};
const bookingStatuses: { value: BookingStatus; label: string }[] = [
  { value: "UNKNOWN", label: "Not specified" }, { value: "TO_BE_DONE", label: "To be done" },
  { value: "IN_PROGRESS", label: "In progress" }, { value: "COMPLETED", label: "Completed" },
  { value: "NOT_NEEDED", label: "Not needed" }, { value: "CANCELLED", label: "Cancelled" },
];
const tripStatuses: { value: TripStatus; label: string }[] = [
  { value: "NOT_SPECIFIED", label: "Not specified in sheet" }, { value: "UPCOMING", label: "Upcoming / planning" }, { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Trip completed" }, { value: "CANCELLED", label: "Trip cancelled" },
];

function titleCase(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
function statusTone(value: string) {
  if (["COMPLETED", "FULL_REFUNDED", "PARTIAL_REFUNDED"].includes(value)) return "green";
  if (["CANCELLED"].includes(value)) return "red";
  if (["IN_PROGRESS", "PENDING"].includes(value)) return "amber";
  if (["TO_BE_DONE", "UPCOMING", "UNKNOWN"].includes(value)) return "blue";
  if (["NOT_NEEDED", "NOT_APPLICABLE"].includes(value)) return "grey";
  return "grey";
}
function tripStatusLabel(status: TripStatus) {
  if (status === "NOT_SPECIFIED") return "Not specified";
  return tripStatuses.find((option) => option.value === status)?.label ?? titleCase(status);
}
function statusChip(status: string, label?: string) {
  return <span className={`status-chip ${statusTone(status)}`}><span className="status-dot" />{label ?? titleCase(status)}</span>;
}
function handlerLabel(handler: Handler) {
  return handler === "TRAVORA" ? "Travora" : handler === "SELF" ? "Self" : handler === "MIXED" ? "Mixed" : "Unassigned";
}

function App() {
  const [page, setPage] = useState<"Overview" | "All trips" | "Bookings" | "Team" | "Customer service">("Overview");
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tripStatusFilter, setTripStatusFilter] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");
  const [bookingServiceFilter, setBookingServiceFilter] = useState("");
  const [bookingOwnerFilter, setBookingOwnerFilter] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [apiConnected, setApiConnected] = useState(false);

  const isAdmin = authUser?.role === "ADMIN";
  const isAgent = authUser?.role === "AGENT";

  useEffect(() => {
    if (!getAuthToken()) { setAuthReady(true); setLoading(false); return; }
    api.me().then(setAuthUser).catch(() => setAuthToken(null)).finally(() => setAuthReady(true));
  }, []);

  async function refreshDashboard() {
    try {
      const [nextSummary, nextTrips] = await Promise.all([api.summary(), api.trips()]);
      setSummary(nextSummary);
      setTrips(nextTrips);
      setApiConnected(true);
      setError("");
    } catch (e) {
      setApiConnected(false);
      setError(e instanceof Error ? e.message : "Unable to load dashboard data");
    } finally { setLoading(false); }
  }

  async function refreshBookings() {
    try {
      const next = await api.bookings({ status: bookingStatusFilter, serviceType: bookingServiceFilter, handledBy: bookingOwnerFilter });
      setBookings(next);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load bookings"); }
  }

  async function refreshTeam() {
    if (!isAdmin) return;
    try {
      const [users, customerOptions, assignments] = await Promise.all([api.users(), api.customers(), api.serviceAssignments()]);
      setTeamUsers(users); setCustomers(customerOptions); setServiceAssignments(assignments);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load team members"); }
  }

  async function refreshSupport() {
    if (!authUser || authUser.role === "AGENT") return;
    try { setSupportRequests(await api.supportRequests()); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load customer service requests"); }
  }

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    void refreshDashboard();
    if (authUser.role === "ADMIN") { void refreshTeam(); void refreshSupport(); }
    if (authUser.role === "VIEWER") void refreshSupport();
  }, [authUser?.id]);

  useEffect(() => { if (authUser && page === "Bookings") void refreshBookings(); }, [authUser?.id, page, bookingStatusFilter, bookingServiceFilter, bookingOwnerFilter]);
  useEffect(() => { if (authUser?.role === "ADMIN" && page === "Team") void refreshTeam(); }, [authUser?.id, page]);
  useEffect(() => { if (authUser && page === "Customer service") void refreshSupport(); }, [authUser?.id, page]);

  async function handleLogin(email: string, password: string) {
    setLoginBusy(true); setLoginError("");
    try {
      const result = await api.login(email, password);
      setAuthToken(result.token);
      setAuthUser(result.user);
      setPage("Overview");
    } catch (e) { setLoginError(e instanceof Error ? e.message : "Unable to sign in"); }
    finally { setLoginBusy(false); }
  }

  function logout() {
    setAuthToken(null); setAuthUser(null); setAuthReady(true); setPage("Overview");
    setTrips([]); setBookings([]); setSummary(null); setSelectedTrip(null); setSupportRequests([]); setError("");
  }

  async function openTrip(id: string) {
    setDrawerLoading(true);
    try { setSelectedTrip(await api.trip(id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to open trip"); }
    finally { setDrawerLoading(false); }
  }

  async function handleCreateTrip(input: { customerName: string; destination: string; startDate: string; operationalNotes: string }) {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const created = await api.createTrip({ ...input, startDate: new Date(`${input.startDate}T00:00:00.000Z`).toISOString() });
      setShowNewTrip(false); await refreshDashboard(); setSelectedTrip(created); setToast("Trip added successfully");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create trip"); }
    finally { setSaving(false); }
  }

  async function handleUpdateService(service: ServiceBooking, input: { itemName: string; bookingStatus: BookingStatus; handledBy: Handler; progressNote: string; notes: string }) {
    if (!selectedTrip) return;
    const isAssignedAgent = isAgent && service.assignment?.agentId === authUser?.id;
    if (!isAdmin && !isAssignedAgent) return;
    setSaving(true);
    try {
      const body = isAdmin
        ? { bookingStatus: input.bookingStatus, handledBy: input.handledBy, itemName: input.itemName || null, progressNote: input.progressNote || null, notes: input.notes || null }
        : { itemName: input.itemName || null, bookingStatus: input.bookingStatus, progressNote: input.progressNote || null, notes: input.notes || null };
      await api.updateService(service.id, body);
      const updated = await api.trip(selectedTrip.id); setSelectedTrip(updated); await refreshDashboard();
      if (page === "Bookings") await refreshBookings();
      setToast(`${serviceNames[service.serviceType]} updated`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update booking"); }
    finally { setSaving(false); }
  }

  async function handleAddService(serviceType: ServiceType) {
    if (!selectedTrip || !isAdmin) return;
    setSaving(true);
    try {
      await api.addService(selectedTrip.id, { serviceType }); setSelectedTrip(await api.trip(selectedTrip.id));
      await refreshDashboard(); setToast(`${serviceNames[serviceType]} item added`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add service item"); }
    finally { setSaving(false); }
  }

  async function handleUpdateTrip(input: Record<string, unknown>) {
    if (!selectedTrip || !isAdmin) return;
    setSaving(true);
    try {
      const updated = await api.updateTrip(selectedTrip.id, input); setSelectedTrip(updated); await refreshDashboard(); setToast("Trip details saved");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save trip"); }
    finally { setSaving(false); }
  }

  async function handleCreateUser(input: { name: string; email: string; password: string; role: "AGENT" | "VIEWER"; customerId?: string }) {
    setSaving(true);
    try { await api.createUser(input); await refreshTeam(); setToast(`${input.role === "AGENT" ? "Agent" : "Customer portal"} account created`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create account"); }
    finally { setSaving(false); }
  }

  async function handleAssignServiceType(serviceType: ServiceType, agentId: string) {
    if (!isAdmin) return;
    try {
      if (agentId) await api.assignServiceType(serviceType, agentId);
      else await api.unassignServiceType(serviceType);
      await Promise.all([refreshTeam(), refreshBookings()]);
      if (selectedTrip) setSelectedTrip(await api.trip(selectedTrip.id));
      setToast(agentId ? `All ${serviceNames[serviceType]} assigned to selected agent` : `${serviceNames[serviceType]} assignment removed`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to assign service category"); }
  }

  async function handleCreateSupport(input: { subject: string; message: string; tripId?: string; serviceBookingId?: string }) {
    setSaving(true);
    try { await api.createSupportRequest(input); await refreshSupport(); setToast("Message sent to Travora customer service"); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to send message"); throw e; }
    finally { setSaving(false); }
  }

  async function handleUpdateSupport(id: string, input: { status: SupportStatus; adminReply: string }) {
    setSaving(true);
    try { await api.updateSupportRequest(id, input); await refreshSupport(); setToast("Customer service request updated"); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update request"); }
    finally { setSaving(false); }
  }

  const filteredTrips = useMemo(() => trips.filter((trip) => {
    const matchesSearch = !search || `${trip.customer.name} ${trip.destination} ${trip.operationalNotes ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !tripStatusFilter || trip.tripStatus === tripStatusFilter;
    return matchesSearch && matchesStatus;
  }), [trips, search, tripStatusFilter]);

  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLowerCase();
    if (!query) return bookings;
    return bookings.filter((booking) => [booking.customerName, booking.destination, dateLabel(booking.startDate), booking.startDate, serviceNames[booking.serviceType], booking.itemName ?? "", booking.displayStatus, titleCase(booking.bookingStatus), handlerLabel(booking.handledBy), booking.notes ?? "", booking.progressNote ?? "", booking.sourceStatusText ?? "", booking.assignment?.agent?.name ?? ""].join(" ").toLowerCase().includes(query));
  }, [bookings, bookingSearch]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!authReady) return <div className="auth-loading"><LoaderCircle className="spin" size={28} />Checking your session…</div>;
  if (!authUser) return <LoginPage busy={loginBusy} error={loginError} onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><Compass size={22} strokeWidth={2.2} /></div><div><div className="brand-name">TRAVORA<span>.</span></div><div className="brand-caption">TRAVEL OPERATIONS</div></div></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav">
          <button className={page === "Overview" ? "nav-item active" : "nav-item"} onClick={() => setPage("Overview")}><LayoutDashboard size={18} />Overview</button>
          <button className={page === "All trips" ? "nav-item active" : "nav-item"} onClick={() => setPage("All trips")}><MapPin size={18} />{authUser.role === "VIEWER" ? "My trips" : "All trips"}<span className="nav-count">{trips.length}</span></button>
          <button className={page === "Bookings" ? "nav-item active" : "nav-item"} onClick={() => setPage("Bookings")}><ClipboardList size={18} />{authUser.role === "VIEWER" ? "My bookings" : authUser.role === "AGENT" ? "My assigned services" : "Booking operations"}</button>
          {isAdmin && <button className={page === "Team" ? "nav-item active" : "nav-item"} onClick={() => setPage("Team")}><Users size={18} />Team & access</button>}
          {authUser.role !== "AGENT" && <button className={page === "Customer service" ? "nav-item active" : "nav-item"} onClick={() => setPage("Customer service")}><MessageSquare size={18} />{isAdmin ? "Customer service inbox" : "Customer service"}{isAdmin && summary?.counts.openSupportRequests ? <span className="nav-count">{summary.counts.openSupportRequests}</span> : null}</button>}
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><div className="note-icon"><Activity size={16} /></div><div><strong>Operations at a glance</strong><p>Keep every trip and booking moving.</p></div></div>
          <div className="profile-row"><div className="profile-avatar">{authUser.name.split(/\s+/).map((part) => part[0]).slice(0,2).join("").toUpperCase()}</div><div><strong>{authUser.name}</strong><span>{authUser.role}</span></div></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{page}</strong></div><div className="topbar-actions">
          <div className={`connection-pill ${apiConnected ? "connected" : "disconnected"}`}><span />{apiConnected ? "API & database connected" : "Connection unavailable"}</div>
          <button className="icon-button" aria-label="Refresh data" onClick={() => { void refreshDashboard(); if (page === "Bookings") void refreshBookings(); if (isAdmin) void refreshSupport(); if (page === "Team" && isAdmin) void refreshTeam(); if (page === "Customer service" && !isAdmin) void refreshSupport(); }}><RefreshCw size={17} /></button>
          <span className="role-pill">{authUser.role}</span><button className="logout-button" onClick={logout}><LogOut size={15} />Sign out</button>
        </div></header>
        <div className="content-wrap">
          {error && <div className="error-banner"><CircleAlert size={17} /><span>{error}. Check permissions and database connectivity.</span><button onClick={() => setError("")}><X size={15} /></button></div>}
          {loading ? <div className="loading-state"><LoaderCircle className="spin" size={28} /><span>Loading trip operations…</span></div> : <>
            {page === "Overview" && summary && <OverviewPage summary={summary} trips={trips} role={authUser.role} supportRequests={isAdmin ? supportRequests : []} onOpenTrip={openTrip} onViewAll={() => setPage("All trips")} onViewSupport={() => setPage("Customer service")} />}
            {page === "All trips" && <TripsPage trips={filteredTrips} search={search} onSearch={setSearch} status={tripStatusFilter} onStatus={setTripStatusFilter} onOpenTrip={openTrip} onNewTrip={() => setShowNewTrip(true)} canCreate={isAdmin} role={authUser.role} />}
            {page === "Bookings" && <BookingsPage bookings={filteredBookings} search={bookingSearch} onSearch={setBookingSearch} status={bookingStatusFilter} onStatus={setBookingStatusFilter} service={bookingServiceFilter} onService={setBookingServiceFilter} owner={bookingOwnerFilter} onOwner={setBookingOwnerFilter} onOpenTrip={openTrip} role={authUser.role} agents={teamUsers.filter((item) => item.role === "AGENT")} assignments={serviceAssignments} onAssignServiceType={handleAssignServiceType} />}
            {page === "Team" && isAdmin && <TeamPage users={teamUsers} customers={customers} saving={saving} onCreate={handleCreateUser} />}
            {page === "Customer service" && authUser.role !== "AGENT" && <CustomerServicePage role={authUser.role} requests={supportRequests} trips={trips} saving={saving} onCreate={handleCreateSupport} onUpdate={handleUpdateSupport} />}
          </>}
        </div>
      </main>
      {drawerLoading && <div className="drawer-scrim"><div className="drawer-loading"><LoaderCircle className="spin" size={24} />Loading trip…</div></div>}
      {selectedTrip && <TripDrawer trip={selectedTrip} saving={saving} role={authUser.role} userId={authUser.id} onClose={() => setSelectedTrip(null)} onSaveService={handleUpdateService} onAddService={handleAddService} onSaveTrip={handleUpdateTrip} />}
      {showNewTrip && isAdmin && <NewTripModal saving={saving} onClose={() => setShowNewTrip(false)} onCreate={handleCreateTrip} />}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function OverviewPage({ summary, trips, role, supportRequests, onOpenTrip, onViewAll, onViewSupport }: { summary: DashboardSummary; trips: Trip[]; role: AppRole; supportRequests: SupportRequest[]; onOpenTrip: (id: string) => void; onViewAll: () => void; onViewSupport: () => void }) {
  const c = summary.counts;
  const stats = [
    { label: "Total trips", value: c.totalTrips, sub: "Across all destinations", icon: MapPin, tone: "blue" },
    { label: "Completed", value: c.completedTrips, sub: "Trips successfully closed", icon: CheckCircle2, tone: "green" },
    { label: "Upcoming / planning", value: c.upcomingTrips, sub: "Trips yet to depart", icon: CalendarDays, tone: "violet" },
    { label: "Cancelled", value: c.cancelledTrips, sub: c.partiallyRefunded ? `${c.partiallyRefunded} partially refunded` : "Cancelled trips", icon: X, tone: "rose" },
  ];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const upcoming = trips.filter((trip) => trip.startDate.slice(0, 10) >= today && trip.tripStatus !== "COMPLETED" && trip.tripStatus !== "CANCELLED").slice(0, 5);
  return (
    <>
      <PageHeading eyebrow="TRIP OPERATIONS / OVERVIEW" title={role === "VIEWER" ? "Your travel overview" : role === "AGENT" ? "Your service workload" : "Good morning, team"} description={role === "VIEWER" ? "Your trips, services and travel updates in one place." : role === "AGENT" ? "Trips and services in the categories assigned to you." : "A clear view of every customer trip, booking and follow-up."} action={<span className="date-stamp"><CalendarDays size={15} />Live workspace</span>} />
      <div className="stats-grid">
        {stats.map((stat) => <div className="stat-card" key={stat.label}><div className={`stat-icon ${stat.tone}`}><stat.icon size={18} /></div><div className="stat-meta">{stat.label}</div><div className="stat-value">{stat.value}</div><div className="stat-sub">{stat.sub}</div></div>)}
      </div>
      <div className="insight-strip">
        <div className="insight-main"><div className="insight-icon"><CircleAlert size={18} /></div><div><strong>{c.bookingNeedsAttention} booking items need attention</strong><p>To-do, in-progress or unspecified service bookings across active trips.</p></div></div>
        <div className="insight-divider" />
        <div className="insight-extra"><span className="insight-number">{c.refundsPending + c.partiallyRefunded}</span><span>Refund records<br />to review</span></div>
        <button className="text-action" onClick={onViewAll}>View trips <ChevronRight size={15} /></button>
      </div>
      <div className="overview-grid">
        <section className="panel upcoming-panel">
          <div className="panel-header"><div><h2>Upcoming departures</h2><p>Next trips in the operating schedule</p></div><button className="quiet-link" onClick={onViewAll}>All trips <ChevronRight size={14} /></button></div>
          <div className="departure-list">
            {upcoming.length === 0 ? <div className="empty-state">No upcoming departures.</div> : upcoming.map((trip) => <button className="departure-row" key={trip.id} onClick={() => onOpenTrip(trip.id)}>
              <div className="departure-date"><strong>{new Date(trip.startDate).toLocaleDateString("en-IN", { day: "2-digit", timeZone: "UTC" })}</strong><span>{new Date(trip.startDate).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</span></div>
              <div className="departure-info"><strong>{trip.customer.name}</strong><span><MapPin size={12} />{trip.destination}</span></div>
              <div className="departure-progress"><div className="progress-track"><span style={{ width: `${trip.progress.percent}%` }} /></div><small>{trip.progress.percent}% ready</small></div>
              <ChevronRight size={16} className="row-chevron" />
            </button>)}
          </div>
        </section>
        <section className="panel service-panel">
          <div className="panel-header"><div><h2>Service booking overview</h2><p>Progress across all trip services</p></div><span className="small-tag">9 categories</span></div>
          <div className="service-overview-list">
            {summary.byService.map((item) => {
              const Icon = serviceIcons[item.serviceType];
              const completeRatio = item.total ? item.completed / item.total * 100 : 0;
              return <div className="service-overview-row" key={item.serviceType}><div className="service-overview-icon"><Icon size={15} /></div><div className="service-overview-name">{serviceNames[item.serviceType]}</div><div className="service-overview-track"><span style={{ width: `${completeRatio}%` }} /></div><div className="service-overview-count">{item.completed}<span>/{item.total}</span></div></div>;
            })}
          </div>
          <div className="service-legend"><span><i className="legend-dot done" />Completed</span><span><i className="legend-dot pending" />Other statuses</span></div>
        </section>
      </div>
      <section className="panel attention-panel">
        <div className="panel-header"><div><h2>Booking items needing attention</h2><p>Earliest trip dates first · Open a trip to update its service details</p></div><span className="count-tag">{summary.needingAttention.length} shown</span></div>
        {summary.needingAttention.length === 0 ? <div className="empty-state">Everything is up to date.</div> : <div className="attention-table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Destination</th><th>Service</th><th>Booking status</th><th>Start date</th><th /></tr></thead><tbody>{summary.needingAttention.slice(0, 6).map((item) => <tr key={item.id} onClick={() => onOpenTrip(item.tripId)}><td><strong>{item.customerName}</strong></td><td>{item.destination}</td><td>{serviceNames[item.serviceType]}{item.itemName && <small className="booking-item-label">{item.itemName}</small>}</td><td>{statusChip(item.bookingStatus, item.bookingStatus === "TO_BE_DONE" ? "To be done" : titleCase(item.bookingStatus))}</td><td>{dateLabel(item.startDate)}</td><td><ChevronRight size={16} className="row-chevron" /></td></tr>)}</tbody></table></div>}
      </section>
      {role === "ADMIN" && <section className="panel support-overview-panel"><div className="panel-header"><div><h2>Customer service requests</h2><p>Messages sent by customers from their portal</p></div><button className="quiet-link" onClick={onViewSupport}>Open inbox <ChevronRight size={14} /></button></div>{supportRequests.filter((item) => item.status !== "RESOLVED").length === 0 ? <div className="empty-state">No open customer service requests.</div> : <div className="support-preview-list">{supportRequests.filter((item) => item.status !== "RESOLVED").slice(0, 4).map((item) => <button className="support-preview-row" key={item.id} onClick={onViewSupport}><span className="support-preview-avatar">{item.customer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="support-preview-main"><strong>{item.subject}</strong><small>{item.customer.name} · {item.serviceBooking ? serviceNames[item.serviceBooking.serviceType] : item.trip ? item.trip.destination : "General request"}</small></span>{statusChip(item.status, titleCase(item.status))}<ChevronRight size={15} /></button>)}</div>}</section>}
    </>
  );
}

function TripsPage({ trips, search, onSearch, status, onStatus, onOpenTrip, onNewTrip, canCreate, role }: { trips: Trip[]; search: string; onSearch: (value: string) => void; status: string; onStatus: (value: string) => void; onOpenTrip: (id: string) => void; onNewTrip: () => void; canCreate: boolean; role: AppRole }) {
  const title = role === "VIEWER" ? "My trips" : role === "AGENT" ? "Assigned trips" : "All trips";
  return <>
    <PageHeading eyebrow="CUSTOMER MANAGEMENT" title={title} description={role === "VIEWER" ? "Your travel details and service progress." : role === "AGENT" ? "Trips containing service categories assigned to you." : "Every customer, destination, travel date and booking status in one place."} action={canCreate ? <button className="primary-button" onClick={onNewTrip}><Plus size={17} />Add trip</button> : <span className="date-stamp">{role === "VIEWER" ? "Your account only" : "Scoped access"}</span>} />
    <section className="panel trips-panel">
      <div className="table-toolbar"><div className="toolbar-search"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search customer, destination or notes…" /></div><div className="toolbar-filters"><SlidersHorizontal size={15} /><select value={status} onChange={(event) => onStatus(event.target.value)}><option value="">All trip statuses</option>{tripStatuses.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></div><span className="results-count">{trips.length} trips</span></div>
      <div className="table-scroll"><table className="data-table trip-table"><thead><tr><th>Customer</th><th>Destination</th><th>Start date</th><th>Trip status</th><th>Booking progress</th><th>Open</th></tr></thead><tbody>
        {trips.map((trip) => <tr key={trip.id} onClick={() => onOpenTrip(trip.id)}><td><div className="customer-cell"><div className="customer-avatar">{trip.customer.name.split(/\s|,/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div><strong>{trip.customer.name}</strong><small>{trip.sourceStatusText || "Customer trip"}</small></div></div></td><td><span className="destination-cell"><MapPin size={13} />{trip.destination}</span></td><td>{dateLabel(trip.startDate)}</td><td>{statusChip(trip.tripStatus, tripStatusLabel(trip.tripStatus))}{trip.refundStatus === "PARTIAL_REFUNDED" && <small className="refund-caption">50% refunded</small>}</td><td><div className="progress-cell"><div className="progress-track"><span style={{ width: `${trip.progress.percent}%` }} /></div><small>{trip.progress.completed}/{trip.progress.total} complete</small></div></td><td><button className="table-open" onClick={(event) => { event.stopPropagation(); onOpenTrip(trip.id); }}>Details <ChevronRight size={14} /></button></td></tr>)}
        {trips.length === 0 && <tr><td colSpan={6}><div className="empty-state">No trips match the current search or filter.</div></td></tr>}
      </tbody></table></div>
    </section>
  </>;
}

function BookingsPage({ bookings, search, onSearch, status, onStatus, service, onService, owner, onOwner, onOpenTrip, role, agents, assignments, onAssignServiceType }: { bookings: BookingRow[]; search: string; onSearch: (value: string) => void; status: string; onStatus: (value: string) => void; service: string; onService: (value: string) => void; owner: string; onOwner: (value: string) => void; onOpenTrip: (id: string) => void; role: AppRole; agents: TeamUser[]; assignments: ServiceAssignment[]; onAssignServiceType: (serviceType: ServiceType, agentId: string) => void }) {
  const isAdmin = role === "ADMIN";
  const assignedAgentByType = new Map(assignments.map((item) => [item.serviceType, item]));
  const title = role === "VIEWER" ? "My bookings" : role === "AGENT" ? "My assigned services" : "Booking operations";
  return <>
    <PageHeading eyebrow="SERVICE WORKFLOW" title={title} description={role === "VIEWER" ? "View the bookings and services linked to your customer account." : role === "AGENT" ? "All customer bookings in the service categories assigned to you." : "Track each flight, stay, activity and travel requirement independently."} action={<span className="date-stamp"><ClipboardList size={15} />Service-level view</span>} />
    {isAdmin && <section className="panel service-assignment-panel"><div className="panel-header"><div><h2>Service-wise agent assignment</h2><p>Assign every booking in a service category across all customers to one agent.</p></div><Users size={19} /></div><div className="service-assignment-grid">{serviceOrder.map((type) => { const assignment = assignedAgentByType.get(type); return <label className="service-assignment-card" key={type}><span>{serviceNames[type]}</span><select value={assignment?.agentId ?? ""} onChange={(event) => onAssignServiceType(type, event.target.value)}><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><small>{assignment ? `All ${serviceNames[type].toLowerCase()} records → ${assignment.agent.name}` : "No agent assigned"}</small></label>; })}</div></section>}
    <section className="panel trips-panel">
      <div className="table-toolbar booking-toolbar"><div className="toolbar-search"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search customer, destination, service or notes…" /></div><div className="toolbar-filters"><Filter size={15} /><select value={status} onChange={(event) => onStatus(event.target.value)}><option value="">All booking statuses</option>{bookingStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></div><div className="toolbar-filters"><select value={service} onChange={(event) => onService(event.target.value)}><option value="">All service categories</option>{serviceOrder.map((item) => <option value={item} key={item}>{serviceNames[item]}</option>)}</select></div><div className="toolbar-filters"><select value={owner} onChange={(event) => onOwner(event.target.value)}><option value="">All handlers</option><option value="TRAVORA">Travora</option><option value="SELF">Self</option><option value="MIXED">Mixed</option><option value="UNASSIGNED">Unassigned</option></select></div><span className="results-count">{bookings.length} records</span></div>
      <div className="table-scroll"><table className="data-table booking-table"><thead><tr><th>Customer</th><th>Destination</th><th>Departure</th><th>Service</th><th>Booking status</th><th>Handled by</th><th>Assigned agent</th><th>Notes</th><th /></tr></thead><tbody>
        {bookings.map((booking) => <tr key={booking.id} onClick={() => onOpenTrip(booking.tripId)}><td><strong>{booking.customerName}</strong><small className="booking-item-label">View customer trip details</small></td><td>{booking.destination}</td><td>{dateLabel(booking.startDate)}</td><td><span className="service-name-cell">{serviceNames[booking.serviceType]}</span>{booking.itemName && <small className="booking-item-label">{booking.itemName}</small>}</td><td>{statusChip(booking.bookingStatus, booking.displayStatus)}</td><td>{handlerLabel(booking.handledBy)}</td><td>{booking.assignment?.agent?.name ?? "—"}</td><td className="notes-cell">{booking.notes || booking.progressNote || "—"}</td><td><ChevronRight size={16} className="row-chevron" /></td></tr>)}
        {bookings.length === 0 && <tr><td colSpan={9}><div className="empty-state">No booking records match these filters.</div></td></tr>}
      </tbody></table></div>
      {role === "AGENT" && <p className="permission-note">You are viewing all records belonging to the service categories assigned to you. You can update those service records only.</p>}
      {role === "VIEWER" && <p className="permission-note">View-only access: this page shows bookings belonging only to your customer profile.</p>}
    </section>
  </>;
}

function TripDrawer({ trip, saving, role, userId, onClose, onSaveService, onAddService, onSaveTrip }: { trip: Trip; saving: boolean; role: AppRole; userId: string; onClose: () => void; onSaveService: (service: ServiceBooking, input: { itemName: string; bookingStatus: BookingStatus; handledBy: Handler; progressNote: string; notes: string }) => void; onAddService: (serviceType: ServiceType) => void; onSaveTrip: (input: Record<string, unknown>) => void }) {
  const [tripStatus, setTripStatus] = useState<TripStatus>(trip.tripStatus);
  const [destination, setDestination] = useState(trip.destination);
  const [startDate, setStartDate] = useState(trip.startDate.slice(0, 10));
  const [operationalNotes, setOperationalNotes] = useState(trip.operationalNotes ?? "");
  const [refundStatus, setRefundStatus] = useState<RefundStatus>(trip.refundStatus);
  const [refundPercentage, setRefundPercentage] = useState(trip.refundPercentage?.toString() ?? "");
  const [refundNotes, setRefundNotes] = useState(trip.refundNotes ?? "");
  const [serviceTab, setServiceTab] = useState<"PENDING" | "COMPLETED">("PENDING");
  const isAdmin = role === "ADMIN";
  useEffect(() => {
    setTripStatus(trip.tripStatus); setDestination(trip.destination); setStartDate(trip.startDate.slice(0, 10));
    setOperationalNotes(trip.operationalNotes ?? ""); setRefundStatus(trip.refundStatus);
    setRefundPercentage(trip.refundPercentage?.toString() ?? ""); setRefundNotes(trip.refundNotes ?? "");
  }, [trip.id, trip.updatedAt]);
  const completedServices = trip.services.filter((item) => item.bookingStatus === "COMPLETED");
  const pendingServices = trip.services.filter((item) => ["UNKNOWN", "TO_BE_DONE", "IN_PROGRESS"].includes(item.bookingStatus));
  const otherServices = trip.services.filter((item) => ["CANCELLED", "NOT_NEEDED"].includes(item.bookingStatus));
  const visibleServices = serviceTab === "COMPLETED" ? completedServices : pendingServices;
  const servicesByType = serviceOrder.map((type) => ({ type, records: visibleServices.filter((item) => item.serviceType === type) })).filter((group) => group.records.length > 0 || (isAdmin && serviceTab === "PENDING"));

  return <div className="drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="trip-drawer">
      <div className="drawer-header"><div><div className="eyebrow">TRIP RECORD · {role}</div><h2>{trip.customer.name}</h2><p><MapPin size={13} />{trip.destination} <span>·</span> {dateLabel(trip.startDate)}</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
      <div className="drawer-progress"><div className="drawer-progress-top"><span>Service completion</span><strong>{trip.progress.percent}%</strong></div><div className="progress-track large"><span style={{ width: `${trip.progress.percent}%` }} /></div><small>{trip.progress.completed} completed · {trip.progress.total} required services</small></div>
      <div className="drawer-content">
        <section className="drawer-section"><div className="drawer-section-title"><h3>Travel details</h3>{statusChip(trip.tripStatus, tripStatusLabel(trip.tripStatus))}</div>
          {isAdmin ? <><div className="form-grid"><label>Destination<input value={destination} onChange={(event) => setDestination(event.target.value)} /></label><label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Trip status<select value={tripStatus} onChange={(event) => setTripStatus(event.target.value as TripStatus)}>{tripStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label></div><label className="full-label">Trip notes<textarea rows={4} value={operationalNotes} onChange={(event) => setOperationalNotes(event.target.value)} placeholder="Itinerary, customer feedback, next steps…" /></label><button className="secondary-button save-trip-button" disabled={saving} onClick={() => onSaveTrip({ destination, startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(), tripStatus, operationalNotes: operationalNotes || null })}><Check size={15} />Save travel details</button></> : <div className="read-only-summary"><div><span>Destination</span><strong>{trip.destination}</strong></div><div><span>Start date</span><strong>{dateLabel(trip.startDate)}</strong></div><div><span>Trip notes</span><strong>{trip.operationalNotes || "No notes"}</strong></div></div>}
        </section>
        <section className="drawer-section"><div className="drawer-section-title"><h3>Service bookings by status</h3><span className="section-hint">Customer service overview</span></div>
          <div className="service-tabs"><button className={serviceTab === "PENDING" ? "active" : ""} onClick={() => setServiceTab("PENDING")}>Pending services <span>{pendingServices.length}</span></button><button className={serviceTab === "COMPLETED" ? "active" : ""} onClick={() => setServiceTab("COMPLETED")}>Completed services <span>{completedServices.length}</span></button></div>
          <div className="service-edit-list">{servicesByType.map(({ type, records }) => <div className="service-group" key={type}>
            <div className="service-group-heading"><strong>{serviceNames[type]}</strong>{isAdmin && <button type="button" onClick={() => onAddService(type)} disabled={saving}><Plus size={12} />Add item</button>}</div>
            {records.map((service, index) => <ServiceEditor key={service.id} service={service} itemNumber={records.length > 1 ? index + 1 : undefined} saving={saving} canEdit={isAdmin || (role === "AGENT" && service.assignment?.agentId === userId)} agentMode={role === "AGENT"} onSave={onSaveService} />)}
          </div>)}
          {servicesByType.length === 0 && <div className="empty-state">No {serviceTab.toLowerCase()} service records for this trip.</div>}
          {serviceTab === "PENDING" && otherServices.length > 0 && <div className="other-statuses"><strong>Other service statuses</strong><p>{otherServices.map((service) => `${serviceNames[service.serviceType]}: ${service.bookingStatus === "NOT_NEEDED" ? "Not needed" : "Cancelled"}`).join(" · ")}</p></div>}
          </div>
          {role === "AGENT" && <p className="permission-note">You can edit only the service bookings assigned to your account. Other records are read-only.</p>}
        </section>
        <section className="drawer-section"><div className="drawer-section-title"><h3>Refund information</h3>{trip.refundPercentage !== null && <span className="refund-percent">{trip.refundPercentage}%</span>}</div>
          {isAdmin ? <><div className="form-grid"><label>Refund status<select value={refundStatus} onChange={(event) => setRefundStatus(event.target.value as RefundStatus)}><option value="NOT_APPLICABLE">Not applicable</option><option value="UNKNOWN">Unknown</option><option value="PENDING">Pending</option><option value="PARTIAL_REFUNDED">Partially refunded</option><option value="FULL_REFUNDED">Fully refunded</option></select></label><label>Refund percentage<input type="number" min="0" max="100" value={refundPercentage} onChange={(event) => setRefundPercentage(event.target.value)} placeholder="e.g. 50" /></label></div><label className="full-label">Refund notes<textarea rows={2} value={refundNotes} onChange={(event) => setRefundNotes(event.target.value)} placeholder="Refund amount, transaction reference, date…" /></label><button className="secondary-button save-trip-button" disabled={saving} onClick={() => onSaveTrip({ refundStatus, refundPercentage: refundPercentage === "" ? null : Number(refundPercentage), refundNotes: refundNotes || null })}><Check size={15} />Save refund details</button></> : <div className="read-only-summary"><div><span>Refund status</span><strong>{titleCase(trip.refundStatus)}</strong></div><div><span>Refund percentage</span><strong>{trip.refundPercentage === null ? "—" : `${trip.refundPercentage}%`}</strong></div><div><span>Refund notes</span><strong>{trip.refundNotes || "No notes"}</strong></div></div>}
          {trip.sourceStatusText && <div className="source-note"><span>Original trip status from sheet</span><strong>{trip.sourceStatusText}</strong></div>}
        </section>
      </div>
    </aside>
  </div>;
}

function ServiceEditor({ service, itemNumber, saving, canEdit, agentMode, onSave }: { service: ServiceBooking; itemNumber?: number; saving: boolean; canEdit: boolean; agentMode: boolean; onSave: (service: ServiceBooking, input: { itemName: string; bookingStatus: BookingStatus; handledBy: Handler; progressNote: string; notes: string }) => void }) {
  const [itemName, setItemName] = useState(service.itemName ?? "");
  const [bookingStatus, setBookingStatus] = useState(service.bookingStatus);
  const [handledBy, setHandledBy] = useState(service.handledBy);
  const [progressNote, setProgressNote] = useState(service.progressNote ?? "");
  const [notes, setNotes] = useState(service.notes ?? "");
  useEffect(() => { setItemName(service.itemName ?? ""); setBookingStatus(service.bookingStatus); setHandledBy(service.handledBy); setProgressNote(service.progressNote ?? ""); setNotes(service.notes ?? ""); }, [service.id, service.itemName, service.bookingStatus, service.handledBy, service.progressNote, service.notes]);
  const changed = itemName !== (service.itemName ?? "") || bookingStatus !== service.bookingStatus || handledBy !== service.handledBy || progressNote !== (service.progressNote ?? "") || notes !== (service.notes ?? "");
  return <div className="service-editor">
    <div className="service-editor-top"><div className="service-editor-name"><strong>{itemNumber ? `Item ${itemNumber}` : "Booking record"}</strong>{service.assignment?.agent && <small className="assignment-caption">Assigned to {service.assignment.agent.name}</small>}</div>{statusChip(service.bookingStatus, service.displayStatus)}</div>
    {!canEdit ? <div className="read-only-summary service-read-only"><div><span>Item</span><strong>{service.itemName || serviceNames[service.serviceType]}</strong></div><div><span>Handled by</span><strong>{handlerLabel(service.handledBy)}</strong></div><div><span>Notes</span><strong>{service.notes || service.progressNote || "—"}</strong></div></div> : agentMode ? <div className="service-edit-fields agent-fields"><label>Item / service details<input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={`e.g. ${serviceNames[service.serviceType]} details`} /></label><label>Booking status<select value={bookingStatus} onChange={(event) => setBookingStatus(event.target.value as BookingStatus)}>{bookingStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>{bookingStatus === "IN_PROGRESS" && <label>Progress note<input value={progressNote} onChange={(event) => setProgressNote(event.target.value)} placeholder="e.g. 2 confirmations left" /></label>}<label className="service-notes-input">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add task update…" /></label><button className="mini-save" disabled={saving || (itemName === (service.itemName ?? "") && bookingStatus === service.bookingStatus && progressNote === (service.progressNote ?? "") && notes === (service.notes ?? ""))} onClick={() => onSave(service, { itemName, bookingStatus, handledBy, progressNote, notes })}>{saving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Save</button></div> : <div className="service-edit-fields"><label>Item / activity name<input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={`e.g. ${serviceNames[service.serviceType]} option`} /></label><label>Booking status<select value={bookingStatus} onChange={(event) => setBookingStatus(event.target.value as BookingStatus)}>{bookingStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label>Handled by<select value={handledBy} onChange={(event) => setHandledBy(event.target.value as Handler)}><option value="UNASSIGNED">Unassigned</option><option value="TRAVORA">Travora</option><option value="SELF">Self</option><option value="MIXED">Mixed</option></select></label>{bookingStatus === "IN_PROGRESS" && <label>Remaining / progress<input value={progressNote} onChange={(event) => setProgressNote(event.target.value)} placeholder="e.g. 2 left" /></label>}<label className="service-notes-input">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add booking notes…" /></label><button className="mini-save" disabled={!changed || saving} onClick={() => onSave(service, { itemName, bookingStatus, handledBy, progressNote, notes })}>{saving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Save</button></div>}
    {service.sourceStatusText && <div className="original-value">Imported value: {service.sourceStatusText}</div>}
  </div>;
}


function LoginPage({ busy, error, onLogin }: { busy: boolean; error: string; onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  return <div className="login-shell"><form className="login-card" onSubmit={(event) => { event.preventDefault(); onLogin(email, password); }}>
    <div className="login-brand"><div className="brand-mark"><Compass size={24} /></div><div><div className="brand-name">TRAVORA<span>.</span></div><div className="brand-caption">TRAVEL OPERATIONS</div></div></div>
    <div><div className="eyebrow">SECURE WORKSPACE</div><h1>Welcome back</h1><p>Sign in to manage customer trips and service bookings.</p></div>
    <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@travora.com" /></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>
    {error && <div className="login-error"><CircleAlert size={15} />{error}</div>}
    <button className="primary-button login-submit" disabled={busy || !email || !password}>{busy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}Sign in</button>
    <small>Access is controlled by your assigned account role.</small>
  </form></div>;
}

function TeamPage({ users, customers, saving, onCreate }: { users: TeamUser[]; customers: CustomerOption[]; saving: boolean; onCreate: (input: { name: string; email: string; password: string; role: "AGENT" | "VIEWER"; customerId?: string }) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"AGENT" | "VIEWER">("AGENT");
  const [customerId, setCustomerId] = useState("");
  const availableCustomers = customers.filter((customer) => !customer.hasPortalAccount);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onCreate({ name, email, password, role, ...(role === "VIEWER" ? { customerId } : {}) });
    setName(""); setEmail(""); setPassword(""); setCustomerId("");
  };
  return <>
    <PageHeading eyebrow="ACCESS CONTROL" title="Team & access" description="Create agent accounts and link customer portal accounts to a specific customer profile." action={<span className="role-pill">ADMIN ONLY</span>} />
    <section className="panel team-create-panel"><div className="panel-header"><div><h2>Create account</h2><p>Agents see assigned service categories. Customer accounts see only the linked customer's trips and bookings.</p></div><UserPlus size={19} /></div>
      <form className="team-create-form" onSubmit={submit}>
        <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>
        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
        <label>Temporary password<input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" /></label>
        <label>Access role<select value={role} onChange={(event) => { const next = event.target.value as "AGENT" | "VIEWER"; setRole(next); if (next === "AGENT") setCustomerId(""); }}><option value="AGENT">Agent</option><option value="VIEWER">User / Customer (view only)</option></select></label>
        {role === "VIEWER" && <label className="customer-link-field">Link to customer profile<select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Select customer</option>{availableCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>}
        <button className="primary-button" disabled={saving || !name.trim() || !email.trim() || password.length < 10 || (role === "VIEWER" && !customerId)}>{saving ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Create {role === "AGENT" ? "agent" : "customer"} account</button>
      </form>
      {role === "VIEWER" && availableCustomers.length === 0 && <p className="permission-note">Every existing customer already has a portal account. Add a customer trip first or check the existing account list.</p>}
    </section>
    <section className="panel team-list-panel"><div className="panel-header"><div><h2>Existing accounts</h2><p>{users.length} team and customer accounts</p></div><Users size={19} /></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Linked customer</th><th>Status</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><span className="role-pill">{user.role}</span></td><td>{user.customer?.name ?? "—"}</td><td>{user.isActive ? statusChip("COMPLETED", "Active") : statusChip("CANCELLED", "Inactive")}</td></tr>)}{users.length === 0 && <tr><td colSpan={5}><div className="empty-state">No agent or customer accounts created yet.</div></td></tr>}</tbody></table></div></section>
  </>;
}

function CustomerServicePage({ role, requests, trips, saving, onCreate, onUpdate }: { role: AppRole; requests: SupportRequest[]; trips: Trip[]; saving: boolean; onCreate: (input: { subject: string; message: string; tripId?: string; serviceBookingId?: string }) => Promise<void>; onUpdate: (id: string, input: { status: SupportStatus; adminReply: string }) => Promise<void> }) {
  const isAdmin = role === "ADMIN";
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tripId, setTripId] = useState("");
  const [serviceBookingId, setServiceBookingId] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, SupportStatus>>({});
  useEffect(() => {
    setReplies((current) => Object.fromEntries(requests.map((request) => [request.id, current[request.id] ?? request.adminReply ?? ""])));
    setStatuses((current) => Object.fromEntries(requests.map((request) => [request.id, current[request.id] ?? request.status])));
  }, [requests]);
  const selectedTrip = trips.find((trip) => trip.id === tripId);
  const relatedServices = selectedTrip?.services ?? [];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await onCreate({ subject: subject.trim(), message: message.trim(), ...(tripId ? { tripId } : {}), ...(serviceBookingId ? { serviceBookingId } : {}) });
      setSubject(""); setMessage(""); setTripId(""); setServiceBookingId("");
    } catch { /* Keep the message in the form so the customer can retry. */ }
  }
  return <>
    <PageHeading eyebrow={isAdmin ? "CUSTOMER RELATIONSHIPS" : "SUPPORT"} title={isAdmin ? "Customer service inbox" : "Contact Travora"} description={isAdmin ? "Messages raised by customers, linked to their trips and service bookings." : "Send a message to the Travora team about your trip or a particular service."} action={<span className="date-stamp"><MessageSquare size={14} />{requests.filter((request) => request.status !== "RESOLVED").length} open</span>} />
    {!isAdmin && <section className="panel support-compose-panel"><div className="panel-header"><div><h2>Send a message</h2><p>Ask a question or request a change to a trip or service. The Travora team will respond here.</p></div><Send size={19} /></div>
      <form className="support-compose-form" onSubmit={submit}>
        <label>Subject<input required minLength={3} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Request to change my flight" /></label>
        <label>Related trip (optional)<select value={tripId} onChange={(event) => { setTripId(event.target.value); setServiceBookingId(""); }}><option value="">General request</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.destination} · {dateLabel(trip.startDate)}</option>)}</select></label>
        {tripId && <label>Related service (optional)<select value={serviceBookingId} onChange={(event) => setServiceBookingId(event.target.value)}><option value="">Entire trip / no specific service</option>{relatedServices.map((service) => <option key={service.id} value={service.id}>{serviceNames[service.serviceType]}{service.itemName ? ` · ${service.itemName}` : ""}</option>)}</select></label>}
        <label>Message<textarea required minLength={5} maxLength={5000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe what you would like to ask or change…" /></label>
        <button className="primary-button" disabled={saving || subject.trim().length < 3 || message.trim().length < 5}>{saving ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}Send to Travora</button>
      </form>
    </section>}
    <section className="panel team-list-panel"><div className="panel-header"><div><h2>{isAdmin ? "Customer requests" : "Your messages"}</h2><p>{requests.length} {requests.length === 1 ? "message" : "messages"}</p></div><Inbox size={19} /></div>
      <div className="support-list">{requests.map((request) => <article className="panel support-request-card" key={request.id}>
        <div className="support-request-header"><div><div className="eyebrow">{isAdmin ? request.customer.name : "YOUR REQUEST"}</div><h2>{request.subject}</h2><p>{isAdmin ? `${request.requester.name} · ${request.requester.email}` : `Sent ${new Date(request.createdAt).toLocaleString("en-IN")}`}</p></div>{statusChip(statuses[request.id] ?? request.status, titleCase(statuses[request.id] ?? request.status))}</div>
        <div className="support-message"><strong>Customer message</strong><p>{request.message}</p></div>
        {(request.trip || request.serviceBooking) && <div className="support-request-footer"><span>Trip: {request.trip ? `${request.trip.destination} · ${dateLabel(request.trip.startDate)}` : "—"}</span><span>Service: {request.serviceBooking ? serviceNames[request.serviceBooking.serviceType] : "General trip request"}</span></div>}
        {request.adminReply && <div className="support-reply"><strong>Reply from Travora</strong><p>{request.adminReply}</p></div>}
        {isAdmin ? <div className="support-admin-controls"><label>Request status<select value={statuses[request.id] ?? request.status} onChange={(event) => setStatuses((current) => ({ ...current, [request.id]: event.target.value as SupportStatus }))}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select></label><label>Reply to customer<textarea rows={3} value={replies[request.id] ?? ""} onChange={(event) => setReplies((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Write a response…" /></label><button className="primary-button" disabled={saving} onClick={() => void onUpdate(request.id, { status: statuses[request.id] ?? request.status, adminReply: replies[request.id] ?? "" })}><Send size={14} />Save response</button></div> : <div className="support-request-footer">Updated {new Date(request.updatedAt).toLocaleString("en-IN")}</div>}
      </article>)}
      {requests.length === 0 && <div className="empty-state">{isAdmin ? "No customer service requests have been received." : "You have not sent a message yet."}</div>}</div>
    </section>
  </>;
}

function NewTripModal({ saving, onClose, onCreate }: { saving: boolean; onClose: () => void; onCreate: (input: { customerName: string; destination: string; startDate: string; operationalNotes: string }) => void }) {
  const [customerName, setCustomerName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [operationalNotes, setOperationalNotes] = useState("");
  const submit = (event: React.FormEvent) => { event.preventDefault(); onCreate({ customerName, destination, startDate, operationalNotes }); };
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="new-trip-modal" onSubmit={submit}><div className="modal-heading"><div><div className="eyebrow">CUSTOMER MANAGEMENT</div><h2>Add a trip</h2><p>Create a customer trip with all nine service records.</p></div><button className="icon-button" type="button" onClick={onClose}><X size={18} /></button></div><label>Customer name<input required autoFocus value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="e.g. Aisha Sharma" /></label><label>Destination<input required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="e.g. Bali" /></label><label>Trip start date<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Trip notes<textarea rows={3} value={operationalNotes} onChange={(event) => setOperationalNotes(event.target.value)} placeholder="Initial itinerary or follow-up notes…" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !customerName || !destination || !startDate}>{saving ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}Create trip</button></div></form></div>;
}

export default App;
