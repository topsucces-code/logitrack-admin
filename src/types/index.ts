// ========================================
// Business Clients (API Clients)
// ========================================

export interface BusinessClient {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone?: string;
  webhook_url?: string;
  plan: 'starter' | 'business' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  client_id: string;
  key_prefix: string;
  name: string;
  environment: 'live' | 'test';
  permissions: string[];
  is_active: boolean;
  last_used_at?: string;
  total_requests: number;
  created_at: string;
  expires_at?: string;
}

// ========================================
// Delivery Companies
// ========================================

export interface DeliveryCompany {
  id: string;
  company_name: string;
  legal_name?: string;
  registration_number?: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country: string;
  owner_name: string;
  owner_phone?: string;
  owner_email?: string;
  logo_url?: string;
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  commission_rate: number;
  min_commission: number;
  can_set_custom_rates: boolean;
  wallet_balance: number;
  total_earnings: number;
  pending_payout: number;
  total_drivers: number;
  active_drivers: number;
  total_deliveries: number;
  completed_deliveries: number;
  rating_sum: number;
  rating_count: number;
  payout_method: 'mobile_money' | 'bank_transfer';
  momo_provider?: string;
  momo_number?: string;
  api_enabled: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  verified_at?: string;
}

export interface CompanyUser {
  id: string;
  company_id: string;
  user_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'owner' | 'admin' | 'manager' | 'dispatcher' | 'accountant';
  permissions: string[];
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface CompanyTransaction {
  id: string;
  company_id: string;
  type: 'delivery_earning' | 'commission_deduction' | 'withdrawal' | 'bonus' | 'penalty' | 'adjustment' | 'refund';
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  created_at: string;
}

// ========================================
// Drivers
// ========================================

export interface Driver {
  id: string;
  user_id: string;
  company_id?: string;
  driver_type: 'independent' | 'company_employed' | 'freelance';
  full_name: string;
  phone: string;
  email?: string;
  vehicle_type: string;
  vehicle_plate?: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  is_online: boolean;
  is_available: boolean;
  current_latitude?: number;
  current_longitude?: number;
  rating_sum: number;
  rating_count: number;
  total_deliveries: number;
  total_earnings: number;
  wallet_balance: number;
  acceptance_rate?: number;
  completion_rate?: number;
  created_at: string;
  updated_at: string;
  company?: { company_name: string };
}

export interface DriverTransaction {
  id: string;
  driver_id: string;
  type: 'delivery_earning' | 'withdrawal' | 'bonus' | 'penalty' | 'adjustment';
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  created_at: string;
}

// ========================================
// Deliveries
// ========================================

export interface Delivery {
  id: string;
  tracking_code: string;
  business_client_id?: string;
  company_id?: string;
  vendor_id?: string;
  driver_id?: string;
  status: DeliveryStatus;
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  delivery_address: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  recipient_name?: string;
  recipient_phone?: string;
  package_description?: string;
  package_size?: 'small' | 'medium' | 'large' | 'extra_large';
  delivery_fee: number;
  total_price: number;
  driver_earnings?: number;
  company_earnings?: number;
  platform_fee?: number;
  payment_method?: 'cash' | 'mobile_money' | 'card' | 'wallet';
  payment_status?: 'pending' | 'paid' | 'failed';
  notes?: string;
  scheduled_pickup_time?: string;
  scheduled_delivery_time?: string;
  picked_up_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
  business_client?: { company_name: string };
  company?: { company_name: string };
  driver?: { full_name: string; phone: string };
}

export type DeliveryStatus =
  | 'pending'
  | 'confirmed'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'cancelled'
  | 'failed';

// ========================================
// Zones
// ========================================

export interface Zone {
  id: string;
  name: string;
  city: string;
  country: string;
  boundaries?: unknown;
  base_price: number;
  price_per_km: number;
  min_price: number;
  max_price?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZonePricing {
  id: string;
  from_zone_id: string;
  to_zone_id: string;
  base_price: number;
  price_per_km: number;
  min_price: number;
  max_price?: number;
  is_active: boolean;
}

// ========================================
// Incidents
// ========================================

export interface Incident {
  id: string;
  delivery_id: string;
  reported_by_type: 'driver' | 'customer' | 'vendor' | 'system';
  reported_by_id?: string;
  incident_type: IncidentType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed' | 'escalated';
  title: string;
  description: string;
  resolution?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  delivery?: Delivery;
}

export type IncidentType =
  | 'package_damaged'
  | 'package_lost'
  | 'delivery_delayed'
  | 'wrong_address'
  | 'customer_unavailable'
  | 'driver_misconduct'
  | 'payment_issue'
  | 'other';

// ========================================
// Dashboard Stats
// ========================================

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalCompanies: number;
  activeCompanies: number;
  pendingCompanies: number;
  totalDeliveries: number;
  todayDeliveries: number;
  totalDrivers: number;
  onlineDrivers: number;
  pendingDrivers: number;
  independentDrivers: number;
  companyDrivers: number;
  totalRevenue: number;
  todayRevenue: number;
  platformCommission: number;
}

export interface ApiUsageStats {
  clientId: string;
  companyName: string;
  totalRequests: number;
  todayRequests: number;
  plan: string;
}

// ========================================
// Admin User
// ========================================

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'support' | 'viewer';
  permissions: string[];
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}
