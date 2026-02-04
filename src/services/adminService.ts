/**
 * LogiTrack Africa Admin Service
 * Service principal pour l'administration de la plateforme
 */

import { supabase } from '../lib/supabase';
import type {
  BusinessClient,
  ApiKey,
  DeliveryCompany,
  Driver,
  Delivery,
  Zone,
  Incident,
  DashboardStats,
  ApiUsageStats,
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
    console.error('Error fetching business clients:', error);
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
    console.error('Error fetching API keys:', error);
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
    console.error('Error fetching delivery companies:', error);
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

export async function getDrivers(status?: string): Promise<Driver[]> {
  let query = supabase
    .from('logitrack_drivers')
    .select('*, company:company_id(company_name)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }
  return data || [];
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
    .update({ status: 'approved', is_verified: true })
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
}): Promise<Delivery[]> {
  let query = supabase
    .from('logitrack_deliveries')
    .select(`
      *,
      business_client:business_client_id(company_name),
      company:company_id(company_name),
      driver:driver_id(full_name, phone)
    `)
    .order('created_at', { ascending: false });

  if (options?.clientId) query = query.eq('business_client_id', options.clientId);
  if (options?.companyId) query = query.eq('company_id', options.companyId);
  if (options?.driverId) query = query.eq('driver_id', options.driverId);
  if (options?.status) query = query.eq('status', options.status);
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching deliveries:', error);
    return [];
  }

  return (data || []).map(d => ({
    ...d,
    delivery_fee: d.total_price || 0,
  }));
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

// ========================================
// Zones
// ========================================

export async function getZones(): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('logitrack_zones')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching zones:', error);
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
}): Promise<Incident[]> {
  let query = supabase
    .from('logitrack_incidents')
    .select(`
      *,
      delivery:delivery_id(tracking_code, pickup_address, delivery_address)
    `)
    .order('created_at', { ascending: false });

  if (options?.status) query = query.eq('status', options.status);
  if (options?.severity) query = query.eq('severity', options.severity);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching incidents:', error);
    return [];
  }
  return data || [];
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
// API Usage Stats
// ========================================

export async function getApiUsageStats(): Promise<ApiUsageStats[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { data: clients } = await supabase
    .from('logitrack_business_clients')
    .select('id, company_name, plan');

  if (!clients) return [];

  const { data: apiKeys } = await supabase
    .from('logitrack_client_api_keys')
    .select('client_id, total_requests');

  const { data: todayRequests } = await supabase
    .from('logitrack_api_requests')
    .select('client_id')
    .gte('created_at', todayISO);

  return clients.map(client => {
    const clientKeys = (apiKeys || []).filter(k => k.client_id === client.id);
    const totalRequests = clientKeys.reduce((sum, k) => sum + (k.total_requests || 0), 0);
    const clientTodayRequests = (todayRequests || []).filter(r => r.client_id === client.id).length;

    return {
      clientId: client.id,
      companyName: client.company_name,
      totalRequests,
      todayRequests: clientTodayRequests,
      plan: client.plan,
    };
  }).sort((a, b) => b.totalRequests - a.totalRequests);
}
