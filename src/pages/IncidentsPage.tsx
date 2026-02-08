import { useEffect, useState, useCallback, memo } from 'react';
import { AlertTriangle, CheckCircle, Clock, Eye, AlertCircle, RotateCcw, Search } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { adminLogger } from '../utils/logger';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { getIncidents, updateIncidentStatus } from '../services/adminService';
import type { Incident } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// --- Helpers (pure functions, no component state dependency) ---

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
    open: { variant: 'danger', label: 'Ouvert' },
    investigating: { variant: 'warning', label: 'En cours' },
    resolved: { variant: 'success', label: 'Résolu' },
    closed: { variant: 'default', label: 'Fermé' },
    escalated: { variant: 'danger', label: 'Escaladé' },
  };
  const c = config[status] || { variant: 'default', label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
};

const getSeverityBadge = (severity: string) => {
  const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
    low: { variant: 'info', label: 'Faible' },
    medium: { variant: 'warning', label: 'Moyen' },
    high: { variant: 'danger', label: 'Élevé' },
    critical: { variant: 'danger', label: 'Critique' },
  };
  const c = config[severity] || { variant: 'default', label: severity };
  return <Badge variant={c.variant}>{c.label}</Badge>;
};

const getIncidentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    package_damaged: 'Colis endommagé',
    package_lost: 'Colis perdu',
    delivery_delayed: 'Retard de livraison',
    wrong_address: 'Mauvaise adresse',
    customer_unavailable: 'Client absent',
    driver_misconduct: 'Comportement livreur',
    payment_issue: 'Problème de paiement',
    other: 'Autre',
  };
  return labels[type] || type;
};

// --- Memoized row component ---

interface IncidentRowProps {
  incident: Incident;
  onViewDetail: (incident: Incident) => void;
}

const IncidentRow = memo(function IncidentRow({ incident, onViewDetail }: IncidentRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="max-w-xs">
          <div className="font-medium truncate">{incident.title}</div>
          <div className="text-xs text-gray-500 truncate">{incident.description}</div>
        </div>
      </TableCell>
      <TableCell>{getIncidentTypeLabel(incident.incident_type)}</TableCell>
      <TableCell>
        {incident.delivery ? (
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {incident.delivery.tracking_code}
          </code>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
      <TableCell>{getStatusBadge(incident.status)}</TableCell>
      <TableCell>
        {format(new Date(incident.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
      </TableCell>
      <TableCell>
        <button
          onClick={() => onViewDetail(incident)}
          className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
          title="Voir détails"
        >
          <Eye className="w-4 h-4" />
        </button>
      </TableCell>
    </TableRow>
  );
});

// --- Main page component ---

export default function IncidentsPage() {
  const { showSuccess, showError } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolution, setResolution] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    loadIncidents();
  }, [statusFilter, severityFilter, page]);

  const loadIncidents = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, total } = await getIncidents({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setIncidents(data);
      setTotalCount(total);
    } catch (error) {
      adminLogger.error('Error loading incidents', { error });
      setLoadError('Erreur lors du chargement des incidents');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedIncident || !resolution) return;
    const result = await updateIncidentStatus(selectedIncident.id, 'resolved', resolution);
    if (!result.success) { showError(result.error || 'Erreur lors de la résolution'); return; }
    showSuccess('Incident résolu');
    setShowDetailModal(false);
    setSelectedIncident(null);
    setResolution('');
    loadIncidents();
  };

  const handleClose = async (id: string) => {
    const result = await updateIncidentStatus(id, 'closed');
    if (!result.success) { showError(result.error || 'Erreur lors de la fermeture'); return; }
    showSuccess('Incident fermé');
    loadIncidents();
  };

  const handleViewDetail = useCallback((incident: Incident) => {
    setSelectedIncident(incident);
    setShowDetailModal(true);
  }, []);

  const stats = {
    total: incidents.length,
    open: incidents.filter((i) => i.status === 'open').length,
    investigating: incidents.filter((i) => i.status === 'investigating').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
  };

  const activeFilterCount = [statusFilter, severityFilter].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const resetFilters = () => {
    setStatusFilter('');
    setSeverityFilter('');
  };

  return (
    <div className="min-h-screen">
      <Header title="Incidents & Litiges" subtitle="Gérez les incidents de livraison" />

      <div className="p-6">
        {loadError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                <AlertTriangle className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.open}</p>
                <p className="text-sm text-gray-500">Ouverts</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.investigating}</p>
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
                <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                <p className="text-sm text-gray-500">Résolus</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les statuts</option>
            <option value="open">Ouvert</option>
            <option value="investigating">En cours</option>
            <option value="resolved">Résolu</option>
            <option value="closed">Fermé</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Toutes les sévérités</option>
            <option value="low">Faible</option>
            <option value="medium">Moyen</option>
            <option value="high">Élevé</option>
            <option value="critical">Critique</option>
          </select>
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

        {/* Table */}
        <Card padding="none">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : incidents.length === 0 ? (
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
                <p className="text-gray-500 text-sm">Aucun incident trouve</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Livraison</TableHead>
                  <TableHead>Sévérité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <IncidentRow
                    key={incident.id}
                    incident={incident}
                    onViewDetail={handleViewDetail}
                  />
                ))}
              </TableBody>
            </Table>
          )}
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              {totalCount} incident{totalCount > 1 ? 's' : ''} au total
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
          setSelectedIncident(null);
          setResolution('');
        }}
        title="Détails de l'incident"
        size="lg"
      >
        {selectedIncident && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedIncident.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Signalé le {format(new Date(selectedIncident.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
              <div className="flex gap-2">
                {getSeverityBadge(selectedIncident.severity)}
                {getStatusBadge(selectedIncident.status)}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p>{selectedIncident.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Type d'incident</p>
                <p className="font-medium">{getIncidentTypeLabel(selectedIncident.incident_type)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Livraison</p>
                <p className="font-medium">
                  {selectedIncident.delivery?.tracking_code || '-'}
                </p>
              </div>
            </div>

            {selectedIncident.resolution && (
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">Résolution</p>
                <p>{selectedIncident.resolution}</p>
              </div>
            )}

            {['open', 'investigating'].includes(selectedIncident.status) && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Résolution
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Décrivez comment l'incident a été résolu..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
                {!resolution && (
                  <p className="text-sm text-gray-400 mt-1">Veuillez saisir une résolution avant de valider</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              {selectedIncident.status === 'resolved' && (
                <Button variant="outline" onClick={() => handleClose(selectedIncident.id)}>
                  Fermer l'incident
                </Button>
              )}
              {['open', 'investigating'].includes(selectedIncident.status) && (
                <Button onClick={handleResolve} disabled={!resolution}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marquer comme résolu
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedIncident(null);
                  setResolution('');
                }}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
