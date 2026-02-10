import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';
import { adminLogger } from '../utils/logger';
import {
  Users,
  Building2,
  Package,
  Truck,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  Radio,
  MapPin,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Header from '../components/layout/Header';
import Card, { CardHeader } from '../components/ui/Card';
import { SkeletonStatCard, SkeletonChartCard, SkeletonListItem } from '../components/ui/Skeleton';
import { getDashboardStats, getDeliveryTrend, getRevenueTrend, getActiveDeliveries } from '../services/adminService';
import type { DashboardStats } from '../types';

interface ActiveDeliveriesData {
  count: number;
  inTransit: number;
  arriving: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deliveryTrendData, setDeliveryTrendData] = useState<{ name: string; livraisons: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ name: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active deliveries live state
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDeliveriesData>({ count: 0, inTransit: 0, arriving: 0 });
  const [liveLastUpdated, setLiveLastUpdated] = useState<Date | null>(null);
  const [livePulse, setLivePulse] = useState(false);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStats = useCallback(async () => {
    setLoadError(null);
    try {
      const [data, trend, revenue] = await Promise.all([
        getDashboardStats(),
        getDeliveryTrend(7),
        getRevenueTrend(6),
      ]);
      setStats(data);
      setDeliveryTrendData(trend);
      setRevenueData(revenue);
    } catch (error) {
      adminLogger.error('Error loading stats', { error });
      setLoadError('Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActiveDeliveries = useCallback(async () => {
    try {
      const data = await getActiveDeliveries();
      setActiveDeliveries(data);
      setLiveLastUpdated(new Date());

      // Trigger pulse animation when there are active deliveries
      if (data.count > 0) {
        setLivePulse(true);
        if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
        pulseTimeout.current = setTimeout(() => setLivePulse(false), 2000);
      }
    } catch (error) {
      adminLogger.error('Error loading active deliveries', { error });
    }
  }, []);

  // Load stats on mount
  useEffect(() => {
    loadStats();
    loadActiveDeliveries();
  }, [loadStats, loadActiveDeliveries]);

  // Real-time subscription for auto-updates (general stats)
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'logitrack_deliveries' },
        () => { loadStats(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'logitrack_drivers' },
        () => { loadStats(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadStats]);

  // Dedicated real-time subscription for live delivery status changes
  useEffect(() => {
    const channel = supabase
      .channel('live-deliveries-status')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'logitrack_deliveries',
          filter: 'status=in.in_transit,arriving,delivered,completed,cancelled,failed',
        },
        () => { loadActiveDeliveries(); }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logitrack_deliveries',
        },
        () => { loadActiveDeliveries(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    };
  }, [loadActiveDeliveries]);

  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return '--';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 5) return 'maintenant';
    if (diffSec < 60) return `il y a ${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `il y a ${diffMin}min`;
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Auto-refresh timestamp display every 10 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard" subtitle="Vue d'ensemble de la plateforme LogiTrack Africa" />
        <div className="p-6 space-y-6">
          {/* Stats Grid skeleton -- 4 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>
          {/* Live deliveries skeleton */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 animate-pulse">
            <div className="h-5 w-40 bg-gray-200 rounded mb-3" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 bg-gray-200 rounded-lg" />
              <div className="h-16 bg-gray-200 rounded-lg" />
              <div className="h-16 bg-gray-200 rounded-lg" />
            </div>
          </div>
          {/* Revenue Stats skeleton -- 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>
          {/* Charts skeleton -- 2 chart areas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChartCard />
            <SkeletonChartCard />
          </div>
          {/* Bottom cards skeleton -- driver distribution + quick actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Driver distribution placeholder */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
              <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonListItem key={i} />
                ))}
              </div>
            </div>
            {/* Quick actions placeholder */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
              <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-24 bg-gray-200 rounded-xl" />
                <div className="h-24 bg-gray-200 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" subtitle="Vue d'ensemble de la plateforme LogiTrack Africa" />

      <div className="p-6 space-y-6">
        {loadError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Clients API */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Clients API</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalClients || 0}</p>
                <p className="text-sm text-green-600 mt-1 flex items-center">
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  {stats?.activeClients || 0} actifs
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          {/* Entreprises */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Entreprises</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalCompanies || 0}</p>
                <p className="text-sm text-yellow-600 mt-1 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {stats?.pendingCompanies || 0} en attente
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          {/* Livreurs */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Livreurs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalDrivers || 0}</p>
                <p className="text-sm text-green-600 mt-1 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {stats?.onlineDrivers || 0} en ligne
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          {/* Livraisons */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Livraisons</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalDeliveries || 0}</p>
                <p className="text-sm text-primary-600 mt-1 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  {stats?.todayDeliveries || 0} aujourd'hui
                </p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Livraisons actives - Real-time live indicator */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Radio className="w-4 h-4 text-red-500" />
                {activeDeliveries.count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Livraisons actives</h3>
              {activeDeliveries.count > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                  EN DIRECT
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">{formatLastUpdated(liveLastUpdated)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Total actives */}
            <button
              onClick={() => navigate('/deliveries?status=in_transit,arriving')}
              className="relative overflow-hidden bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg p-3 text-left transition-all hover:shadow-md"
            >
              {livePulse && activeDeliveries.count > 0 && (
                <div className="absolute inset-0 bg-red-400/10 animate-pulse rounded-lg" />
              )}
              <div className="relative">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total actives</p>
                <p className={`text-xl font-bold mt-0.5 ${
                  activeDeliveries.count > 0 ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {activeDeliveries.count}
                </p>
              </div>
            </button>

            {/* En transit */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-0.5">
                <Truck className="w-3 h-3 text-blue-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">En transit</p>
              </div>
              <p className={`text-xl font-bold ${
                activeDeliveries.inTransit > 0 ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {activeDeliveries.inTransit}
              </p>
            </div>

            {/* En approche */}
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-0.5">
                <MapPin className="w-3 h-3 text-amber-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">En approche</p>
              </div>
              <p className={`text-xl font-bold ${
                activeDeliveries.arriving > 0 ? 'text-amber-600' : 'text-gray-400'
              }`}>
                {activeDeliveries.arriving}
              </p>
            </div>
          </div>
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenus totaux</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats?.totalRevenue || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenus du jour</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats?.todayRevenue || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Commission plateforme</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats?.platformCommission || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Delivery Trend */}
          <Card>
            <CardHeader title="Livraisons cette semaine" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deliveryTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="livraisons" fill="#ed7410" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Revenue Trend */}
          <Card>
            <CardHeader title="Évolution des revenus" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `${v / 1000000}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Driver Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Répartition des livreurs" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3" />
                  <span className="text-sm text-gray-600">Indépendants</span>
                </div>
                <span className="font-semibold">{stats?.independentDrivers || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-3" />
                  <span className="text-sm text-gray-600">Entreprises</span>
                </div>
                <span className="font-semibold">{stats?.companyDrivers || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3" />
                  <span className="text-sm text-gray-600">En attente d'approbation</span>
                </div>
                <span className="font-semibold">{stats?.pendingDrivers || 0}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Actions rapides" />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => navigate('/drivers')} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left">
                <AlertTriangle className="w-6 h-6 text-yellow-500 mb-2" />
                <p className="font-medium text-gray-900">Livreurs en attente</p>
                <p className="text-sm text-gray-500">{stats?.pendingDrivers || 0} à vérifier</p>
              </button>
              <button onClick={() => navigate('/companies')} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left">
                <Building2 className="w-6 h-6 text-purple-500 mb-2" />
                <p className="font-medium text-gray-900">Entreprises en attente</p>
                <p className="text-sm text-gray-500">{stats?.pendingCompanies || 0} à valider</p>
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
