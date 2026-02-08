import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Header from '../components/layout/Header';
import Card, { CardHeader } from '../components/ui/Card';
import { getDashboardStats, getDeliveryTrend, getRevenueTrend } from '../services/adminService';
import type { DashboardStats } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deliveryTrendData, setDeliveryTrendData] = useState<{ name: string; livraisons: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ name: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Real-time subscription for auto-updates
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
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
