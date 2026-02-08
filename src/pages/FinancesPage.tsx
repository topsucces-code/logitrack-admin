import { useEffect, useState, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ArrowUpRight, AlertCircle, Calendar, Download, Printer } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { adminLogger } from '../utils/logger';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Header from '../components/layout/Header';
import Card, { CardHeader } from '../components/ui/Card';
import { SkeletonStatCard, SkeletonChartCard, SkeletonTable } from '../components/ui/Skeleton';
import { getDashboardStats, getDeliveries, getRevenueByDay, getRevenueDistribution, getPendingPayments } from '../services/adminService';
import type { DashboardStats, Delivery } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type RevenuePeriod = '7d' | '30d' | 'thisMonth' | 'custom';

const periodLabels: Record<RevenuePeriod, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  'thisMonth': 'Mois en cours',
  'custom': 'Période personnalisée',
};

export default function FinancesPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDeliveries, setRecentDeliveries] = useState<Delivery[]>([]);
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number; commission: number }[]>([]);
  const [distributionData, setDistributionData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [pendingPayments, setPendingPayments] = useState({ count: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState<RevenuePeriod>('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [revenueLoading, setRevenueLoading] = useState(false);

  const loadRevenueData = useCallback(async (period: RevenuePeriod, startDate?: string, endDate?: string) => {
    setRevenueLoading(true);
    try {
      let revenue: { date: string; revenue: number; commission: number }[];

      switch (period) {
        case '7d':
          revenue = await getRevenueByDay(7);
          break;
        case '30d':
          revenue = await getRevenueByDay(30);
          break;
        case 'thisMonth': {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const firstDayStr = firstDay.toISOString().split('T')[0];
          const todayStr = now.toISOString().split('T')[0];
          revenue = await getRevenueByDay(undefined, firstDayStr, todayStr);
          break;
        }
        case 'custom':
          if (startDate && endDate) {
            revenue = await getRevenueByDay(undefined, startDate, endDate);
          } else {
            revenue = await getRevenueByDay(7);
          }
          break;
        default:
          revenue = await getRevenueByDay(7);
      }

      setRevenueData(revenue);
    } catch (error) {
      adminLogger.error('Error loading revenue data', { error });
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [statsData, deliveriesData, revenue, distribution, pending] = await Promise.all([
        getDashboardStats(),
        getDeliveries({ status: 'delivered,completed', limit: 10 }),
        getRevenueByDay(7),
        getRevenueDistribution(),
        getPendingPayments(),
      ]);
      setStats(statsData);
      setRecentDeliveries(deliveriesData.data);
      setRevenueData(revenue);
      setDistributionData(distribution);
      setPendingPayments(pending);
    } catch (error) {
      adminLogger.error('Error loading finances data', { error });
      setLoadError('Erreur lors du chargement des données financières');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: RevenuePeriod) => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      loadRevenueData(period);
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      loadRevenueData('custom', customStartDate, customEndDate);
    }
  };

  const exportFinancesCSV = () => {
    const lines: string[] = [];

    // Section 1: Résumé
    lines.push('=== Résumé ===');
    lines.push('Indicateur,Valeur');
    lines.push(`Revenus totaux,${stats?.totalRevenue || 0}`);
    lines.push(`Revenus du jour,${stats?.todayRevenue || 0}`);
    lines.push(`Commission plateforme,${stats?.platformCommission || 0}`);
    lines.push(`Paiements en attente,${pendingPayments.total}`);
    lines.push(`Nombre de demandes en attente,${pendingPayments.count}`);
    lines.push('');

    // Section 2: Revenus par jour
    lines.push('=== Revenus par jour ===');
    lines.push('Date,Revenus,Commission');
    revenueData.forEach((r) => {
      lines.push(`${r.date},${r.revenue},${r.commission}`);
    });
    lines.push('');

    // Section 3: Distribution
    lines.push('=== Distribution des revenus ===');
    lines.push('Catégorie,Pourcentage');
    distributionData.forEach((d) => {
      lines.push(`${d.name},${d.value}%`);
    });
    lines.push('');

    // Section 4: Dernières livraisons
    lines.push('=== Dernières livraisons payées ===');
    lines.push('Code,Client,Montant,Livreur,Commission,Date');
    recentDeliveries.forEach((d) => {
      lines.push([
        d.tracking_code,
        d.business_client?.company_name || '-',
        d.total_price || 0,
        d.driver_earnings || 0,
        d.platform_fee || 0,
        new Date(d.created_at).toLocaleDateString('fr-FR'),
      ].join(','));
    });

    const csv = lines.join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finances_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Finances" subtitle="Aperçu financier de la plateforme" />
        <div className="p-6 space-y-6">
          {/* Main Stats skeleton -- 4 cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>
          {/* Charts skeleton -- 2/3 + 1/3 split matching lg:grid-cols-3 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SkeletonChartCard className="lg:col-span-2" />
            <SkeletonChartCard />
          </div>
          {/* Table skeleton -- 6 columns, 5 rows */}
          <SkeletonTable rows={5} columns={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Print-only header - hidden on screen */}
      <div className="print-only-header">
        <h1>LogiTrack Africa</h1>
        <h2>Rapport Financier</h2>
        <p>{format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
      </div>

      <Header title="Finances" subtitle="Aperçu financier de la plateforme" />

      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
          <button
            onClick={exportFinancesCSV}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>
        {loadError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenus totaux</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats?.totalRevenue || 0)}
                </p>
                <p className="text-sm text-green-600 mt-1 flex items-center">
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  {stats?.totalDeliveries || 0} livraisons
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
                <p className="text-sm text-gray-500 mt-1">
                  {stats?.todayDeliveries || 0} livraisons
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
                <p className="text-sm text-primary-600 mt-1 flex items-center">
                  {stats?.totalRevenue ? Math.round((stats.platformCommission / stats.totalRevenue) * 100) : 0}% en moyenne
                </p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Paiements en attente</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(pendingPayments.total)}
                </p>
                <p className="text-sm text-yellow-600 mt-1 flex items-center">
                  {pendingPayments.count} demandes
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Évolution des revenus"
              subtitle={
                selectedPeriod === 'custom' && customStartDate && customEndDate
                  ? `Du ${customStartDate.split('-').reverse().join('/')} au ${customEndDate.split('-').reverse().join('/')}`
                  : periodLabels[selectedPeriod]
              }
            />

            {/* Period Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
              {([
                ['7d', '7 jours'],
                ['30d', '30 jours'],
                ['thisMonth', 'Ce mois'],
                ['custom', 'Personnalisé'],
              ] as [RevenuePeriod, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handlePeriodChange(key)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    selectedPeriod === key
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {key === 'custom' && <Calendar className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                  {label}
                </button>
              ))}
            </div>

            {/* Custom Date Range Inputs */}
            {selectedPeriod === 'custom' && (
              <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-gray-50 rounded-lg no-print">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <button
                  onClick={handleCustomDateApply}
                  disabled={!customStartDate || !customEndDate || revenueLoading}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Appliquer
                </button>
              </div>
            )}

            <div className="h-72 relative">
              {revenueLoading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-lg">
                  <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Revenus"
                    dot={{ fill: '#22c55e' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="commission"
                    stroke="#ed7410"
                    strokeWidth={2}
                    name="Commission"
                    dot={{ fill: '#ed7410' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Distribution Pie Chart */}
          <Card>
            <CardHeader title="Distribution des revenus" />
            <div className="h-72 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="70%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-4">
                {distributionData.map((item) => (
                  <div key={item.name} className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">
                      {item.name} ({item.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader title="Dernières livraisons payées" />
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Code</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Livreur</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Commission</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {delivery.tracking_code}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {delivery.business_client?.company_name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium">{formatCurrency(delivery.total_price || 0)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-green-600">{formatCurrency(delivery.driver_earnings || 0)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-primary-600">{formatCurrency(delivery.platform_fee || 0)}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {format(new Date(delivery.created_at), 'dd MMM yyyy', { locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Print-only footer */}
        <div className="print-only-footer">
          <p>Imprime le {format(new Date(), "dd/MM/yyyy 'a' HH:mm", { locale: fr })} - LogiTrack Africa</p>
        </div>
      </div>
    </div>
  );
}
