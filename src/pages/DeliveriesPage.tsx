import { useEffect, useState } from 'react';
import { Search, Eye, MapPin, Package, Clock, CheckCircle, Truck, AlertCircle, Download, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { adminLogger } from '../utils/logger';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { getDeliveries, getDelivery, updateDeliveryStatus, getDeliveryStatusHistory } from '../services/adminService';
import type { Delivery, StatusHistoryEntry } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ADMIN_STATUS_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  pending: [{ value: 'cancelled', label: 'Annuler' }],
  searching: [{ value: 'cancelled', label: 'Annuler' }],
  assigned: [{ value: 'cancelled', label: 'Annuler' }],
  accepted: [{ value: 'cancelled', label: 'Annuler' }],
  picking_up: [{ value: 'cancelled', label: 'Annuler' }, { value: 'failed', label: 'Échouée' }],
  picked_up: [{ value: 'cancelled', label: 'Annuler' }, { value: 'failed', label: 'Échouée' }],
  in_transit: [{ value: 'delivered', label: 'Livrée' }, { value: 'failed', label: 'Échouée' }, { value: 'returned', label: 'Retournée' }, { value: 'cancelled', label: 'Annuler' }],
  arriving: [{ value: 'delivered', label: 'Livrée' }, { value: 'failed', label: 'Échouée' }, { value: 'returned', label: 'Retournée' }],
  delivered: [{ value: 'completed', label: 'Terminée' }],
  returned: [{ value: 'completed', label: 'Terminée' }],
};

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    loadDeliveries();
  }, [statusFilter, page]);

  const loadDeliveries = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, total } = await getDeliveries({
        status: statusFilter || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setDeliveries(data);
      setTotalCount(total);
    } catch (error) {
      adminLogger.error('Error loading deliveries', { error });
      setLoadError('Erreur lors du chargement des livraisons');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    const delivery = await getDelivery(id);
    if (delivery) {
      setSelectedDelivery(delivery);
      setNewStatus('');
      setUpdateError(null);
      setShowDetailModal(true);
      setHistoryLoading(true);
      const history = await getDeliveryStatusHistory(id);
      setStatusHistory(history);
      setHistoryLoading(false);
    }
  };

  const activeFilterCount = [searchQuery, statusFilter].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
  };

  const filteredDeliveries = deliveries.filter(
    (delivery) =>
      delivery.tracking_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.pickup_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.delivery_address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['Code', 'Client', 'Pickup', 'Destination', 'Montant', 'Statut', 'Date'];
    const rows = filteredDeliveries.map(d => [
      d.tracking_code || '',
      d.business_client?.company_name || d.company?.company_name || '-',
      (d.pickup_address || '').replace(/,/g, ' '),
      (d.delivery_address || '').replace(/,/g, ' '),
      d.total_price || 0,
      d.status,
      new Date(d.created_at).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `livraisons-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
      pending: { variant: 'warning', label: 'En attente' },
      searching: { variant: 'warning', label: 'Recherche livreur' },
      assigned: { variant: 'info', label: 'Assignée' },
      accepted: { variant: 'info', label: 'Acceptée' },
      picking_up: { variant: 'info', label: 'En route pickup' },
      picked_up: { variant: 'info', label: 'Récupérée' },
      in_transit: { variant: 'info', label: 'En transit' },
      arriving: { variant: 'info', label: 'Arrivée' },
      delivered: { variant: 'success', label: 'Livrée' },
      completed: { variant: 'success', label: 'Terminée' },
      cancelled: { variant: 'danger', label: 'Annulée' },
      failed: { variant: 'danger', label: 'Échouée' },
      returned: { variant: 'warning', label: 'Retournée' },
    };
    const config = statusConfig[status] || { variant: 'default', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };


  const getTimelineColor = (status: string): { dot: string; line: string; bg: string; text: string } => {
    const completedStatuses = ['delivered', 'completed'];
    const inProgressStatuses = ['assigned', 'accepted', 'picking_up', 'picked_up', 'in_transit', 'arriving'];
    const cancelledStatuses = ['cancelled', 'failed'];
    const pendingStatuses = ['pending', 'searching'];

    if (completedStatuses.includes(status)) {
      return { dot: 'bg-green-500', line: 'bg-green-200', bg: 'bg-green-50', text: 'text-green-700' };
    }
    if (inProgressStatuses.includes(status)) {
      return { dot: 'bg-blue-500', line: 'bg-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' };
    }
    if (cancelledStatuses.includes(status)) {
      return { dot: 'bg-red-500', line: 'bg-red-200', bg: 'bg-red-50', text: 'text-red-700' };
    }
    if (pendingStatuses.includes(status)) {
      return { dot: 'bg-gray-400', line: 'bg-gray-200', bg: 'bg-gray-50', text: 'text-gray-700' };
    }
    return { dot: 'bg-gray-400', line: 'bg-gray-200', bg: 'bg-gray-50', text: 'text-gray-600' };
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'En attente',
      searching: 'Recherche livreur',
      assigned: 'Assignee',
      accepted: 'Acceptee',
      picking_up: 'En route pickup',
      picked_up: 'Recuperee',
      in_transit: 'En transit',
      arriving: 'Arrivee',
      delivered: 'Livree',
      completed: 'Terminee',
      cancelled: 'Annulee',
      failed: 'Echouee',
      returned: 'Retournee',
    };
    return labels[status] || status;
  };

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    inProgress: deliveries.filter((d) => ['assigned', 'picked_up', 'in_transit'].includes(d.status)).length,
    delivered: deliveries.filter((d) => d.status === 'delivered').length,
    cancelled: deliveries.filter((d) => ['cancelled', 'failed'].includes(d.status)).length,
  };

  return (
    <div className="min-h-screen">
      <Header title="Livraisons" subtitle="Suivez toutes les livraisons de la plateforme" />

      <div className="p-6">
        {loadError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par code, adresse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="assigned">Assignée</option>
            <option value="picked_up">Récupérée</option>
            <option value="in_transit">En transit</option>
            <option value="delivered">Livrée</option>
            <option value="cancelled">Annulée</option>
          </select>
          <button
            onClick={handleExportCSV}
            disabled={filteredDeliveries.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 ml-auto text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reinitialiser ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                <Package className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-sm text-gray-500">En attente</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                <p className="text-sm text-gray-500">En cours</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
                <p className="text-sm text-gray-500">Livrées</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <Package className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
                <p className="text-sm text-gray-500">Annulées</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card padding="none">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Search className="w-10 h-10 text-gray-300 mb-3" />
              {hasActiveFilters ? (
                <>
                  <p className="text-gray-500 text-sm">Aucun resultat pour ces filtres</p>
                  <button
                    onClick={resetFilters}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    Effacer les filtres
                  </button>
                </>
              ) : (
                <p className="text-gray-500 text-sm">Aucune livraison trouvee</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Livreur</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {delivery.tracking_code}
                      </code>
                    </TableCell>
                    <TableCell>
                      {delivery.business_client?.company_name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="flex items-start text-sm">
                          <MapPin className="w-3 h-3 text-green-500 mr-1 mt-0.5 flex-shrink-0" />
                          <span className="truncate">{delivery.pickup_address}</span>
                        </div>
                        <div className="flex items-start text-sm mt-1">
                          <MapPin className="w-3 h-3 text-red-500 mr-1 mt-0.5 flex-shrink-0" />
                          <span className="truncate">{delivery.delivery_address}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {delivery.driver ? (
                        <div>
                          <div className="font-medium">{delivery.driver.full_name}</div>
                          <div className="text-xs text-gray-500">{delivery.driver.phone}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Non assigné</span>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(delivery.total_price || 0)}</TableCell>
                    <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                    <TableCell>
                      {format(new Date(delivery.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleViewDetail(delivery.id)}
                        className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              {totalCount} livraison{totalCount > 1 ? 's' : ''} au total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Précédent
              </button>
              <span className="text-sm text-gray-700">
                Page {page} / {Math.ceil(totalCount / pageSize) || 1}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(totalCount / pageSize)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDelivery(null);
          setStatusHistory([]);
        }}
        title={`Livraison ${selectedDelivery?.tracking_code}`}
        size="lg"
      >
        {selectedDelivery && (
          <div className="space-y-6">
            {/* Status + Update */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedDelivery.status)}
                <span className="text-sm text-gray-500">
                  Créée le {format(new Date(selectedDelivery.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </span>
              </div>

              {/* Status Update Controls */}
              {ADMIN_STATUS_TRANSITIONS[selectedDelivery.status] && (
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Changer le statut...</option>
                    {ADMIN_STATUS_TRANSITIONS[selectedDelivery.status].map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!newStatus || updating}
                    loading={updating}
                    onClick={async () => {
                      if (!newStatus || !selectedDelivery) return;
                      setUpdating(true);
                      setUpdateError(null);
                      const result = await updateDeliveryStatus(selectedDelivery.id, newStatus);
                      if (result.success) {
                        setNewStatus('');
                        const updated = await getDelivery(selectedDelivery.id);
                        if (updated) setSelectedDelivery(updated);
                        const history = await getDeliveryStatusHistory(selectedDelivery.id);
                        setStatusHistory(history);
                        loadDeliveries();
                      } else {
                        setUpdateError(result.error || 'Erreur lors de la mise à jour');
                      }
                      setUpdating(false);
                    }}
                  >
                    Mettre à jour
                  </Button>
                </div>
              )}
              {updateError && (
                <p className="text-sm text-red-600">{updateError}</p>
              )}
            </div>

            {/* Addresses */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Enlèvement</p>
                  <p className="font-medium">{selectedDelivery.pickup_address}</p>
                  {selectedDelivery.pickup_contact_name && (
                    <p className="text-sm text-gray-500">
                      {selectedDelivery.pickup_contact_name} - {selectedDelivery.pickup_contact_phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="border-l-2 border-dashed border-gray-300 ml-4 h-4" />
              <div className="flex items-start">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                  <MapPin className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Livraison</p>
                  <p className="font-medium">{selectedDelivery.delivery_address}</p>
                  {selectedDelivery.recipient_name && (
                    <p className="text-sm text-gray-500">
                      {selectedDelivery.recipient_name} - {selectedDelivery.recipient_phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Client API</p>
                <p className="font-medium">{selectedDelivery.business_client?.company_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Entreprise</p>
                <p className="font-medium">{selectedDelivery.company?.company_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Livreur</p>
                <p className="font-medium">
                  {selectedDelivery.driver?.full_name || 'Non assigné'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Description colis</p>
                <p className="font-medium">{selectedDelivery.package_description || '-'}</p>
              </div>
            </div>

            {/* Pricing */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Tarification</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Prix total</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedDelivery.total_price || 0)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Gains livreur</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(selectedDelivery.driver_earnings || 0)}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Commission plateforme</p>
                  <p className="text-xl font-bold text-primary-600">
                    {formatCurrency(selectedDelivery.platform_fee || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Historique des statuts</h4>
              {historyLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : statusHistory.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Aucun historique disponible</p>
              ) : (
                <div className="relative ml-3">
                  {statusHistory.map((entry, index) => {
                    const isLast = index === statusHistory.length - 1;
                    const colors = getTimelineColor(entry.new_status);
                    return (
                      <div key={entry.id} className="relative flex items-start pb-4">
                        {/* Vertical line */}
                        {!isLast && (
                          <div className={`absolute left-[7px] top-4 w-0.5 h-full ${colors.line}`} />
                        )}
                        {/* Dot */}
                        <div className={`relative z-10 w-4 h-4 rounded-full ${colors.dot} border-2 border-white shadow-sm flex-shrink-0 mt-0.5`} />
                        {/* Content */}
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                              {getStatusLabel(entry.new_status)}
                            </span>
                            {entry.old_status && (
                              <span className="text-xs text-gray-400">
                                depuis {getStatusLabel(entry.old_status)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(entry.created_at), "dd MMM yyyy 'a' HH:mm:ss", { locale: fr })}
                          </p>
                          {entry.changed_by && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Par : {entry.changed_by}
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-gray-600 mt-1 bg-gray-50 px-2 py-1 rounded">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
