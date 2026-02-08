import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, CheckCircle, Ban, XCircle, Eye, Phone, AlertCircle, Download, RotateCcw } from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/format';
import { adminLogger } from '../utils/logger';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { getDrivers, approveDriver, suspendDriver, rejectDriver } from '../services/adminService';
import type { Driver } from '../types';

export default function DriversPage() {
  const { showSuccess, showError } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onSearch: useCallback(() => searchInputRef.current?.focus(), []),
    onEscape: useCallback(() => {
      if (showDetailModal) {
        setShowDetailModal(false);
        setSelectedDriver(null);
      } else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, [showDetailModal]),
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    loadDrivers();
  }, [statusFilter, page]);

  const loadDrivers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, total } = await getDrivers({
        status: statusFilter || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setDrivers(data);
      setTotalCount(total);
    } catch (error) {
      adminLogger.error('Error loading drivers', { error });
      setLoadError('Erreur lors du chargement des chauffeurs');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const result = await approveDriver(id);
    if (!result.success) { showError(result.error || 'Erreur lors de l\'approbation'); return; }
    showSuccess('Chauffeur approuvé');
    loadDrivers();
  };

  const handleSuspend = async (id: string) => {
    const result = await suspendDriver(id);
    if (!result.success) { showError(result.error || 'Erreur lors de la suspension'); return; }
    showSuccess('Chauffeur suspendu');
    loadDrivers();
  };

  const handleReject = async (id: string) => {
    const result = await rejectDriver(id);
    if (!result.success) { showError(result.error || 'Erreur lors du rejet'); return; }
    showSuccess('Chauffeur rejeté');
    loadDrivers();
  };

  const activeFilterCount = [searchQuery, statusFilter].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
  };

  const filteredDrivers = drivers.filter(
    (driver) =>
      driver.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.includes(searchQuery)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approuvé</Badge>;
      case 'pending':
        return <Badge variant="warning">En attente</Badge>;
      case 'suspended':
        return <Badge variant="danger">Suspendu</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejeté</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getOnlineStatus = (driver: Driver) => {
    if (driver.status !== 'approved') return null;
    return driver.is_online ? (
      <span className="flex items-center text-green-600 text-sm">
        <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse" />
        En ligne
      </span>
    ) : (
      <span className="flex items-center text-gray-400 text-sm">
        <span className="w-2 h-2 bg-gray-300 rounded-full mr-1.5" />
        Hors ligne
      </span>
    );
  };


  const getRating = (driver: Driver) => {
    if (!driver.rating_count) return '-';
    return (driver.rating_sum / driver.rating_count).toFixed(1);
  };

  const handleExportCSV = () => {
    const headers = ['Nom', 'Téléphone', 'Type', 'Véhicule', 'Livraisons', 'Gains', 'Note', 'Statut'];
    const rows = filteredDrivers.map(d => [
      d.full_name,
      d.phone,
      d.company_id ? 'Entreprise' : 'Indépendant',
      d.vehicle_type || '-',
      d.total_deliveries,
      d.total_earnings,
      d.rating_count ? (d.rating_sum / d.rating_count).toFixed(1) : '-',
      d.status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `livreurs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <Header title="Livreurs" subtitle="Gérez les livreurs de la plateforme" />

      <div className="p-6">
        {loadError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher un livreur..."
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
            <option value="approved">Approuvé</option>
            <option value="suspended">Suspendu</option>
            <option value="rejected">Rejeté</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
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
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-sm text-gray-500">Total</p>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-green-600">
              {drivers.filter((d) => d.status === 'approved').length}
            </p>
            <p className="text-sm text-gray-500">Approuvés</p>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-yellow-600">
              {drivers.filter((d) => d.status === 'pending').length}
            </p>
            <p className="text-sm text-gray-500">En attente</p>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-blue-600">
              {drivers.filter((d) => d.is_online && d.status === 'approved').length}
            </p>
            <p className="text-sm text-gray-500">En ligne</p>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-red-600">
              {drivers.filter((d) => d.status === 'suspended').length}
            </p>
            <p className="text-sm text-gray-500">Suspendus</p>
          </Card>
        </div>

        {/* Table */}
        <Card padding="none">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredDrivers.length === 0 ? (
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
                <p className="text-gray-500 text-sm">Aucun livreur trouve</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Livreur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Livraisons</TableHead>
                  <TableHead>Gains</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-primary-600 font-semibold">
                            {driver.full_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{driver.full_name}</div>
                          <div className="text-xs text-gray-500">{driver.phone}</div>
                          {getOnlineStatus(driver)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={driver.company_id ? 'info' : 'default'}>
                        {driver.company_id ? 'Entreprise' : 'Indépendant'}
                      </Badge>
                      {driver.company && (
                        <p className="text-xs text-gray-500 mt-1">{driver.company.company_name}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{driver.vehicle_type}</div>
                      {driver.vehicle_plate && (
                        <div className="text-xs text-gray-500">{driver.vehicle_plate}</div>
                      )}
                    </TableCell>
                    <TableCell>{driver.total_deliveries}</TableCell>
                    <TableCell>{formatCurrency(driver.total_earnings)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="text-yellow-500 mr-1">★</span>
                        {getRating(driver)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(driver.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedDriver(driver);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {driver.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(driver.id)}
                              className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg"
                              title="Approuver"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(driver.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                              title="Rejeter"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {driver.status === 'approved' && (
                          <button
                            onClick={() => handleSuspend(driver.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                            title="Suspendre"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        {driver.status === 'suspended' && (
                          <button
                            onClick={() => handleApprove(driver.id)}
                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg"
                            title="Réactiver"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              {totalCount} livreur{totalCount > 1 ? 's' : ''} au total
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
          setSelectedDriver(null);
        }}
        title={selectedDriver?.full_name || 'Détails du livreur'}
        size="lg"
      >
        {selectedDriver && (
          <div className="space-y-6">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl text-primary-600 font-bold">
                  {selectedDriver.full_name.charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold">{selectedDriver.full_name}</h3>
                <div className="flex items-center gap-4 mt-1">
                  {getStatusBadge(selectedDriver.status)}
                  {getOnlineStatus(selectedDriver)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center text-gray-600">
                <Phone className="w-4 h-4 mr-2" />
                {selectedDriver.phone}
              </div>
              {selectedDriver.email && (
                <div className="text-gray-600">{selectedDriver.email}</div>
              )}
              <div>
                <p className="text-sm text-gray-500">Véhicule</p>
                <p className="font-medium">
                  {selectedDriver.vehicle_type}
                  {selectedDriver.vehicle_plate && ` - ${selectedDriver.vehicle_plate}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium">
                  {selectedDriver.company_id ? 'Employé' : 'Indépendant'}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Statistiques</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold">{selectedDriver.total_deliveries}</p>
                  <p className="text-xs text-gray-500">Livraisons</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold">{formatCurrency(selectedDriver.total_earnings)}</p>
                  <p className="text-xs text-gray-500">Gains</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold">
                    <span className="text-yellow-500">★</span> {getRating(selectedDriver)}
                  </p>
                  <p className="text-xs text-gray-500">Note</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold">{formatCurrency(selectedDriver.wallet_balance)}</p>
                  <p className="text-xs text-gray-500">Solde</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              {selectedDriver.status === 'pending' && (
                <>
                  <Button variant="danger" onClick={() => handleReject(selectedDriver.id)}>
                    Rejeter
                  </Button>
                  <Button onClick={() => handleApprove(selectedDriver.id)}>Approuver</Button>
                </>
              )}
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
