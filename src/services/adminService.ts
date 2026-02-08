/**
 * LogiTrack Africa Admin Service
 * Service principal pour l'administration de la plateforme
 */

import { supabase } from '../lib/supabase';
import { adminLogger } from '../utils/logger';
import type {
  BusinessClient,
  ApiKey,
  DeliveryCompany,
  Driver,
  Delivery,
  StatusHistoryEntry,
  Zone,
  Incident,
  DashboardStats,

  AdminNotification,
} from '../types';

// ========================================
// Dashboard Stats
// ========================================

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [
    clientsResult,
    companiesResult,
    deliveriesResult,
    todayDeliveriesResult,
    driversResult,
    onlineDriversResult,
    pendingDriversResult,
    independentDriversResult,
    companyDriversResult,
  ] = await Promise.all([
    supabase.from('logitrack_business_clients').select('id, status'),
    supabase.from('logitrack_delivery_companies').select('id, status'),
    supabase.from('logitrack_deliveries').select('id, total_price, platform_fee, status'),
    supabase.from('logitrack_deliveries').select('id, total_price, platform_fee, status').gte('created_at', todayISO),
    supabase.from('logitrack_drivers').select('id').eq('status', 'approved'),
    supabase.from('logitrack_drivers').select('id').eq('is_online', true).eq('status', 'approved'),
    supabase.from('logitrack_drivers').select('id').eq('status', 'pending'),
    supabase.from('logitrack_drivers').select('id').eq('status', 'approved').is('company_id', null),
    supabase.from('logitrack_drivers').select('id').eq('status', 'approved').not('company_id', 'is', null),
  ]);

  const clients = clientsResult.data || [];
  const companies = companiesResult.data || [];
  const deliveries = deliveriesResult.data || [];
  const todayDeliveries = todayDeliveriesResult.data || [];
  const drivers = driversResult.data || [];
  const onlineDrivers = onlineDriversResult.data || [];
  const pendingDrivers = pendingDriversResult.data || [];
  const independentDrivers = independentDriversResult.data || [];
  const companyDrivers = companyDriversResult.data || [];

  const completedStatuses = ['delivered', 'completed'];
  const completedDeliveries = deliveries.filter(d => completedStatuses.includes(d.status));

  const totalRevenue = completedDeliveries.reduce((sum, d) => sum + (d.total_price || 0), 0);
  const todayRevenue = todayDeliveries
    .filter(d => completedStatuses.includes(d.status))
    .reduce((sum, d) => sum + (d.total_price || 0), 0);
  const platformCommission = completedDeliveries.reduce((sum, d) => sum + (d.platform_fee || 0), 0);

  return {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    totalCompanies: companies.length,
    activeCompanies: companies.filter(c => c.status === 'active').length,
    pendingCompanies: companies.filter(c => c.status === 'pending').length,
    totalDeliveries: deliveries.length,
    todayDeliveries: todayDeliveries.length,
    totalDrivers: drivers.length,
    onlineDrivers: onlineDrivers.length,
    pendingDrivers: pendingDrivers.length,
    independentDrivers: independentDrivers.length,
    companyDrivers: companyDrivers.length,
    totalRevenue,
    todayRevenue,
    platformCommission,
  };
}

// ========================================
// Business Clients
// ========================================

export async function getBusinessClients(): Promise<BusinessClient[]> {
  const { data, error } = await supabase
    .from('logitrack_business_clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    adminLogger.error('Error fetching business clients', { error });
    return [];
  }
  return data || [];
}

export async function getBusinessClient(id: string): Promise<BusinessClient | null> {
  const { data, error } = await supabase
    .from('logitrack_business_clients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function createBusinessClient(client: Partial<BusinessClient>): Promise<{ success: boolean; client?: BusinessClient; error?: string }> {
  const { data, error } = await supabase
    .from('logitrack_business_clients')
    .insert({
      company_name: client.company_name,
      contact_email: client.contact_email,
      contact_phone: client.contact_phone,
      webhook_url: client.webhook_url,
      plan: client.plan || 'starter',
      status: 'active',
      settings: client.settings || {},
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, client: data };
}

export async function updateBusinessClient(id: string, updates: Partial<BusinessClient>): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_business_clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function suspendBusinessClient(id: string): Promise<{ success: boolean; error?: string }> {
  return updateBusinessClient(id, { status: 'suspended' });
}

export async function activateBusinessClient(id: string): Promise<{ success: boolean; error?: string }> {
  return updateBusinessClient(id, { status: 'active' });
}

// ========================================
// API Keys
// ========================================

export async function getApiKeys(clientId?: string): Promise<ApiKey[]> {
  let query = supabase
    .from('logitrack_client_api_keys')
    .select('*')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) {
    adminLogger.error('Error fetching API keys', { error });
    return [];
  }
  return data || [];
}

export async function createApiKey(
  clientId: string,
  name: string,
  environment: 'live' | 'test' = 'live'
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const keyHash = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const client = await getBusinessClient(clientId);
  if (!client) return { success: false, error: 'Client not found' };

  const prefix = client.company_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const fullKey = `lt_${environment}_${prefix}_${keyHash}`;
  const keyPrefix = fullKey.slice(0, 15);

  const encoder = new TextEncoder();
  const data = encoder.encode(fullKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const storedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const { error } = await supabase
    .from('logitrack_client_api_keys')
    .insert({
      client_id: clientId,
      key_prefix: keyPrefix,
      key_hash: storedHash,
      name,
      environment,
      permissions: ['deliveries:read', 'deliveries:write', 'quotes:read'],
      is_active: true,
    });

  if (error) return { success: false, error: error.message };
  return { success: true, apiKey: fullKey };
}

export async function revokeApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_client_api_keys')
    .update({ is_active: false })
    .eq('id', keyId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ========================================
// Delivery Companies
// ========================================

export async function getDeliveryCompanies(status?: string): Promise<DeliveryCompany[]> {
  let query = supabase
    .from('logitrack_delivery_companies')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    adminLogger.error('Error fetching delivery companies', { error });
    return [];
  }
  return data || [];
}

export async function getDeliveryCompany(id: string): Promise<DeliveryCompany | null> {
  const { data, error } = await supabase
    .from('logitrack_delivery_companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function createDeliveryCompany(company: Partial<DeliveryCompany>): Promise<{ success: boolean; company?: DeliveryCompany; error?: string }> {
  const { data, error } = await supabase
    .from('logitrack_delivery_companies')
    .insert({
      company_name: company.company_name,
      legal_name: company.legal_name,
      registration_number: company.registration_number,
      email: company.email,
      phone: company.phone,
      address: company.address,
      city: company.city,
      country: company.country || 'Côte d\'Ivoire',
      owner_name: company.owner_name,
      owner_phone: company.owner_phone,
      owner_email: company.owner_email,
      logo_url: company.logo_url,
      commission_rate: company.commission_rate || 15,
      status: 'pending',
      settings: company.settings || {},
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, company: data };
}

export async function updateDeliveryCompany(id: string, updates: Partial<DeliveryCompany>): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_delivery_companies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function activateDeliveryCompany(id: string): Promise<{ success: boolean; error?: string }> {
  return updateDeliveryCompany(id, { status: 'active', verified_at: new Date().toISOString() } as Partial<DeliveryCompany>);
}

export async function suspendDeliveryCompany(id: string): Promise<{ success: boolean; error?: string }> {
  return updateDeliveryCompany(id, { status: 'suspended' });
}

// ========================================
// Drivers
// ========================================

export async function getDrivers(options?: { status?: string; limit?: number; offset?: number }): Promise<{ data: Driver[]; total: number }> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('logitrack_drivers')
    .select('*, company:company_id(company_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.status) query = query.eq('status', options.status);

  const { data, error, count } = await query;
  if (error) {
    adminLogger.error('Error fetching drivers', { error });
    return { data: [], total: 0 };
  }
  return { data: data || [], total: count ?? 0 };
}

export async function getDriver(id: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from('logitrack_drivers')
    .select('*, company:company_id(company_name)')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function approveDriver(driverId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_drivers')
    .update({ status: 'approved' })
    .eq('id', driverId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function suspendDriver(driverId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_drivers')
    .update({ status: 'suspended', is_online: false })
    .eq('id', driverId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function rejectDriver(driverId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_drivers')
    .update({ status: 'rejected' })
    .eq('id', driverId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ========================================
// Deliveries
// ========================================

export async function getDeliveries(options?: {
  clientId?: string;
  companyId?: string;
  driverId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Delivery[]; total: number }> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('logitrack_deliveries')
    .select(`
      *,
      business_client:business_client_id(company_name),
      company:company_id(company_name),
      driver:driver_id(full_name, phone)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.clientId) query = query.eq('business_client_id', options.clientId);
  if (options?.companyId) query = query.eq('company_id', options.companyId);
  if (options?.driverId) query = query.eq('driver_id', options.driverId);
  if (options?.status) {
    const statuses = options.status.split(',');
    query = statuses.length > 1 ? query.in('status', statuses) : query.eq('status', options.status);
  }

  const { data, error, count } = await query;
  if (error) {
    adminLogger.error('Error fetching deliveries', { error });
    return { data: [], total: 0 };
  }

  const deliveries = (data || []).map(d => ({
    ...d,
    delivery_fee: d.total_price || 0,
  }));
  return { data: deliveries, total: count ?? 0 };
}

export async function getDelivery(id: string): Promise<Delivery | null> {
  const { data, error } = await supabase
    .from('logitrack_deliveries')
    .select(`
      *,
      business_client:business_client_id(company_name),
      company:company_id(company_name),
      driver:driver_id(full_name, phone)
    `)
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function updateDeliveryStatus(id: string, status: string): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'picked_up') updates.picked_up_at = new Date().toISOString();
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();

  const { error } = await supabase
    .from('logitrack_deliveries')
    .update(updates)
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getDeliveryStatusHistory(deliveryId: string): Promise<StatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('logitrack_delivery_status_history')
    .select('*')
    .eq('delivery_id', deliveryId)
    .order('created_at', { ascending: true });

  if (error) {
    adminLogger.error('Error fetching delivery status history', { error, deliveryId });
    return [];
  }
  return data || [];
}

// ========================================
// Zones
// ========================================

export async function getZones(): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('logitrack_zones')
    .select('*')
    .order('name');

  if (error) {
    adminLogger.error('Error fetching zones', { error });
    return [];
  }
  return data || [];
}

export async function createZone(zone: Partial<Zone>): Promise<{ success: boolean; zone?: Zone; error?: string }> {
  const { data, error } = await supabase
    .from('logitrack_zones')
    .insert({
      name: zone.name,
      city: zone.city,
      country: zone.country || 'Côte d\'Ivoire',
      base_price: zone.base_price || 500,
      price_per_km: zone.price_per_km || 100,
      min_price: zone.min_price || 500,
      max_price: zone.max_price,
      is_active: true,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, zone: data };
}

export async function updateZone(id: string, updates: Partial<Zone>): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_zones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ========================================
// Incidents
// ========================================

export async function getIncidents(options?: {
  status?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Incident[]; total: number }> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('logitrack_incidents')
    .select(`
      *,
      delivery:delivery_id(tracking_code, pickup_address, delivery_address)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.status) query = query.eq('status', options.status);
  if (options?.severity) query = query.eq('severity', options.severity);

  const { data, error, count } = await query;
  if (error) {
    adminLogger.error('Error fetching incidents', { error });
    return { data: [], total: 0 };
  }
  return { data: data || [], total: count ?? 0 };
}

export async function updateIncidentStatus(
  id: string,
  status: string,
  resolution?: string
): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (resolution) {
    updates.resolution = resolution;
    updates.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('logitrack_incidents')
    .update(updates)
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ========================================
// Platform Settings
// ========================================

export async function getSettings(): Promise<Record<string, Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('logitrack_platform_settings')
    .select('key, value');

  if (error) {
    adminLogger.error('Error fetching settings', { error });
    return {};
  }

  const settings: Record<string, Record<string, unknown>> = {};
  for (const row of data || []) {
    settings[row.key] = row.value as Record<string, unknown>;
  }
  return settings;
}

export async function updateSettings(
  key: string,
  value: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_platform_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ========================================
// Chart Data
// ========================================

export async function getRevenueByDay(
  days?: number,
  startDateStr?: string,
  endDateStr?: string
): Promise<{ date: string; revenue: number; commission: number }[]> {
  let fromDate: Date;
  let toDate: Date;

  if (startDateStr && endDateStr) {
    // Custom date range
    fromDate = new Date(startDateStr + 'T00:00:00');
    toDate = new Date(endDateStr + 'T23:59:59');
  } else {
    // Default: last N days (backward compatible)
    const numDays = days ?? 7;
    fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - numDays);
    fromDate.setHours(0, 0, 0, 0);
    toDate = new Date();
    toDate.setHours(23, 59, 59, 999);
  }

  const { data, error } = await supabase
    .from('logitrack_deliveries')
    .select('total_price, platform_fee, created_at')
    .in('status', ['delivered', 'completed'])
    .gte('created_at', fromDate.toISOString())
    .lte('created_at', toDate.toISOString());

  if (error) {
    adminLogger.error('Error fetching revenue by day', { error });
    return [];
  }

  // Build day buckets between fromDate and toDate
  const byDay: Record<string, { revenue: number; commission: number }> = {};
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = cursor.toISOString().split('T')[0];
    byDay[key] = { revenue: 0, commission: 0 };
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const row of data || []) {
    const key = new Date(row.created_at).toISOString().split('T')[0];
    if (byDay[key]) {
      byDay[key].revenue += row.total_price || 0;
      byDay[key].commission += row.platform_fee || 0;
    }
  }

  return Object.entries(byDay).map(([date, vals]) => ({
    date: `${date.split('-')[2]}/${date.split('-')[1]}`,
    revenue: vals.revenue,
    commission: vals.commission,
  }));
}

export async function getRevenueDistribution(): Promise<{ name: string; value: number; color: string }[]> {
  const { data, error } = await supabase
    .from('logitrack_deliveries')
    .select('driver_earnings, company_earnings, platform_fee')
    .in('status', ['delivered', 'completed']);

  if (error) {
    adminLogger.error('Error fetching distribution', { error });
    return [
      { name: 'Livreurs', value: 0, color: '#22c55e' },
      { name: 'Entreprises', value: 0, color: '#3b82f6' },
      { name: 'Plateforme', value: 0, color: '#ed7410' },
    ];
  }

  let totalDrivers = 0;
  let totalCompanies = 0;
  let totalPlatform = 0;

  for (const row of data || []) {
    totalDrivers += row.driver_earnings || 0;
    totalCompanies += row.company_earnings || 0;
    totalPlatform += row.platform_fee || 0;
  }

  const total = totalDrivers + totalCompanies + totalPlatform;
  if (total === 0) {
    return [
      { name: 'Livreurs', value: 0, color: '#22c55e' },
      { name: 'Entreprises', value: 0, color: '#3b82f6' },
      { name: 'Plateforme', value: 0, color: '#ed7410' },
    ];
  }

  return [
    { name: 'Livreurs', value: Math.round((totalDrivers / total) * 100), color: '#22c55e' },
    { name: 'Entreprises', value: Math.round((totalCompanies / total) * 100), color: '#3b82f6' },
    { name: 'Plateforme', value: Math.round((totalPlatform / total) * 100), color: '#ed7410' },
  ];
}

export async function getDeliveryTrend(days: number = 7): Promise<{ name: string; livraisons: number }[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('logitrack_deliveries')
    .select('created_at')
    .gte('created_at', startDate.toISOString());

  if (error) {
    adminLogger.error('Error fetching delivery trend', { error });
    return [];
  }

  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const byDay: Record<string, { name: string; livraisons: number }> = {};

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().split('T')[0];
    byDay[key] = { name: dayNames[d.getDay()], livraisons: 0 };
  }

  for (const row of data || []) {
    const key = new Date(row.created_at).toISOString().split('T')[0];
    if (byDay[key]) {
      byDay[key].livraisons++;
    }
  }

  return Object.values(byDay);
}

export async function getRevenueTrend(months: number = 6): Promise<{ name: string; revenue: number }[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('logitrack_deliveries')
    .select('total_price, created_at')
    .in('status', ['delivered', 'completed'])
    .gte('created_at', startDate.toISOString());

  if (error) {
    adminLogger.error('Error fetching revenue trend', { error });
    return [];
  }

  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const byMonth: Record<string, { name: string; revenue: number }> = {};

  for (let i = 0; i < months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (months - 1 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = { name: monthNames[d.getMonth()], revenue: 0 };
  }

  for (const row of data || []) {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (byMonth[key]) {
      byMonth[key].revenue += row.total_price || 0;
    }
  }

  return Object.values(byMonth);
}

export async function getPendingPayments(): Promise<{ count: number; total: number }> {
  const { data, error } = await supabase
    .from('logitrack_deliveries')
    .select('total_price')
    .eq('status', 'delivered')
    .eq('payment_status', 'pending');

  if (error) {
    adminLogger.error('Error fetching pending payments', { error });
    return { count: 0, total: 0 };
  }

  return {
    count: (data || []).length,
    total: (data || []).reduce((sum, d) => sum + (d.total_price || 0), 0),
  };
}

// ========================================
// Admin Notifications
// ========================================

export async function getNotifications(limit: number = 20): Promise<AdminNotification[]> {
  const { data, error } = await supabase
    .from('logitrack_admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    adminLogger.error('Error fetching notifications', { error });
    return [];
  }
  return data || [];
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('logitrack_admin_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) {
    adminLogger.error('Error fetching unread count', { error });
    return 0;
  }
  return count || 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase
    .from('logitrack_admin_notifications')
    .update({ is_read: true })
    .eq('id', id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase
    .from('logitrack_admin_notifications')
    .update({ is_read: true })
    .eq('is_read', false);
}
