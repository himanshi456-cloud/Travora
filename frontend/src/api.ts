import type { AppUser, BookingRow, CustomerOption, DashboardSummary, ServiceAssignment, SupportRequest, SupportStatus, TeamUser, Trip } from "./types";
const TOKEN_KEY = "travora_access_token";
let authToken: string | null = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
export function setAuthToken(token: string | null) { authToken = token; if (typeof window !== "undefined") { if (token) window.localStorage.setItem(TOKEN_KEY, token); else window.localStorage.removeItem(TOKEN_KEY); } }
export function getAuthToken() { return authToken; }
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options?.headers ? options.headers as Record<string, string> : {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}
export const api = {
  login: (email: string, password: string) => request<{ token: string; user: AppUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<AppUser>("/api/auth/me"),
  users: () => request<TeamUser[]>("/api/users"),
  customers: () => request<CustomerOption[]>("/api/customers"),
  createUser: (body: { name: string; email: string; password: string; role: "AGENT" | "VIEWER"; customerId?: string }) => request<TeamUser>("/api/users", { method: "POST", body: JSON.stringify(body) }),
  serviceAssignments: () => request<ServiceAssignment[]>("/api/service-assignments"),
  assignServiceType: (serviceType: string, agentId: string) => request<ServiceAssignment>(`/api/service-assignments/${serviceType}`, { method: "PUT", body: JSON.stringify({ agentId }) }),
  unassignServiceType: (serviceType: string) => request<void>(`/api/service-assignments/${serviceType}`, { method: "DELETE" }),
  supportRequests: () => request<SupportRequest[]>("/api/support"),
  createSupportRequest: (body: { subject: string; message: string; tripId?: string; serviceBookingId?: string }) => request<SupportRequest>("/api/support", { method: "POST", body: JSON.stringify(body) }),
  updateSupportRequest: (id: string, body: { status?: SupportStatus; adminReply?: string | null }) => request<SupportRequest>(`/api/support/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  summary: () => request<DashboardSummary>("/api/dashboard/summary"),
  trips: (query = "", status = "") => { const params = new URLSearchParams(); if (query) params.set("search", query); if (status) params.set("status", status); return request<Trip[]>(`/api/trips?${params.toString()}`); },
  trip: (id: string) => request<Trip>(`/api/trips/${id}`),
  updateTrip: (id: string, body: Record<string, unknown>) => request<Trip>(`/api/trips/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  createTrip: (body: Record<string, unknown>) => request<Trip>("/api/trips", { method: "POST", body: JSON.stringify(body) }),
  addService: (tripId: string, body: { serviceType: string; itemName?: string }) => request(`/api/trips/${tripId}/services`, { method: "POST", body: JSON.stringify(body) }),
  updateService: (id: string, body: Record<string, unknown>) => request(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  bookings: (filters: { status?: string; serviceType?: string; handledBy?: string } = {}) => { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); }); return request<BookingRow[]>(`/api/bookings?${params.toString()}`); },
};
