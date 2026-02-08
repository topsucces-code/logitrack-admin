import { useEffect, useState, useCallback } from 'react';
import { Eye, CheckCircle, XCircle, Clock, FileText, User, AlertCircle, X, ChevronLeft, ChevronRight, Square, CheckSquare, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { adminLogger } from '../utils/logger';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DriverDocument {
  id: string;
  full_name: string;
  phone: string;
  profile_photo_url?: string;
  id_card_front_url?: string;
  id_card_back_url?: string;
  license_front_url?: string;
  license_back_url?: string;
  vehicle_registration_url?: string;
  insurance_url?: string;
  verification_status: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function DocumentReviewPage() {
  const { showSuccess, showError } = useToast();
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedDoc, setSelectedDoc] = useState<DriverDocument | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // Rejection modal (separate from detail modal)
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetDoc, setRejectTargetDoc] = useState<DriverDocument | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');

  // Stats (loaded separately to avoid being affected by pagination)
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0 });

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter]);

  useEffect(() => {
    loadDocuments();
  }, [statusFilter, page]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const [pendingRes, verifiedRes, rejectedRes] = await Promise.all([
      supabase.from('logitrack_drivers').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabase.from('logitrack_drivers').select('id', { count: 'exact', head: true }).eq('verification_status', 'verified'),
      supabase.from('logitrack_drivers').select('id', { count: 'exact', head: true }).eq('verification_status', 'rejected'),
    ]);
    setStats({
      pending: pendingRes.count ?? 0,
      verified: verifiedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
    });
  }

  async function loadDocuments() {
    setLoading(true);
    const offset = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from('logitrack_drivers')
      .select('id, full_name, phone, profile_photo_url, id_card_front_url, id_card_back_url, license_front_url, license_back_url, vehicle_registration_url, insurance_url, verification_status, status, rejection_reason, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (statusFilter) {
      query = query.eq('verification_status', statusFilter);
    }

    const { data, error, count } = await query;
    if (error) {
      adminLogger.error('Error loading documents', { error });
      setLoadError('Erreur lors du chargement des documents');
    } else {
      setLoadError(null);
    }
    setDocuments((data as DriverDocument[]) || []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }

  async function handleApprove(doc: DriverDocument) {
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('logitrack_drivers')
        .update({
          verification_status: 'verified',
          status: 'approved',
          rejection_reason: null,
        })
        .eq('id', doc.id);

      if (error) throw error;

      showSuccess('Documents approuves avec succes');
      setShowModal(false);
      loadDocuments();
      loadStats();
    } catch (err) {
      adminLogger.error('Error approving document', { error: err });
      showError("Erreur lors de l'approbation du document");
    } finally {
      setProcessing(false);
    }
  }

  function openRejectModal(doc: DriverDocument) {
    setRejectTargetDoc(doc);
    setRejectReasonInput('');
    setRejectReasonError('');
    setShowRejectModal(true);
  }

  async function handleRejectConfirm() {
    if (!rejectReasonInput.trim()) {
      setRejectReasonError('Le motif du rejet est obligatoire');
      return;
    }
    if (!rejectTargetDoc) return;

    setProcessing(true);

    try {
      const { error } = await supabase
        .from('logitrack_drivers')
        .update({
          verification_status: 'rejected',
          status: 'rejected',
          rejection_reason: rejectReasonInput.trim(),
        })
        .eq('id', rejectTargetDoc.id);

      if (error) throw error;

      showSuccess('Documents rejetes');
      setShowRejectModal(false);
      setShowModal(false);
      setRejectTargetDoc(null);
      setRejectReasonInput('');
      loadDocuments();
      loadStats();
    } catch (err) {
      adminLogger.error('Error rejecting document', { error: err });
      showError('Erreur lors du rejet du document');
    } finally {
      setProcessing(false);
    }
  }

  // Bulk selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  }, [documents, selectedIds.size]);

  const allSelected = documents.length > 0 && selectedIds.size === documents.length;
  const someSelected = selectedIds.size > 0;

  // Bulk approve
  async function handleBulkApprove() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: ids.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ids.length; i++) {
      try {
        const { error } = await supabase
          .from('logitrack_drivers')
          .update({
            verification_status: 'verified',
            status: 'approved',
            rejection_reason: null,
          })
          .eq('id', ids[i]);

        if (error) throw error;
        successCount++;
      } catch (err) {
        adminLogger.error('Bulk approve error for driver', { driverId: ids[i], error: err });
        failCount++;
      }
      setBulkProgress({ current: i + 1, total: ids.length });
    }

    setBulkProcessing(false);
    setSelectedIds(new Set());

    if (failCount === 0) {
      showSuccess(`${successCount} livreur${successCount > 1 ? 's' : ''} approuve${successCount > 1 ? 's' : ''} avec succes`);
    } else {
      showError(`${successCount} approuve${successCount > 1 ? 's' : ''}, ${failCount} echoue${failCount > 1 ? 's' : ''}`);
    }

    loadDocuments();
    loadStats();
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">En attente</Badge>;
      case 'verified':
        return <Badge variant="success">Verifie</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejete</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  }

  /** Count how many document URLs are present on a driver row */
  function getDocumentCount(doc: DriverDocument): number {
    let count = 0;
    if (doc.id_card_front_url) count++;
    if (doc.id_card_back_url) count++;
    if (doc.license_front_url) count++;
    if (doc.license_back_url) count++;
    if (doc.vehicle_registration_url) count++;
    if (doc.insurance_url) count++;
    return count;
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div className="min-h-screen">
      <Header
        title="Verification des documents"
        subtitle="Revue des documents d'identite des livreurs"
      />

      <div className="p-6">
        {loadError && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{loadError}</p>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="verified">Verifies</option>
            <option value="rejected">Rejetes</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
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
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                <p className="text-sm text-gray-500">Verifies</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                <p className="text-sm text-gray-500">Rejetes</p>
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
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucun document trouve</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="p-0.5 text-gray-400 hover:text-primary-600 transition-colors"
                      title={allSelected ? 'Tout deselectionnner' : 'Tout selectionner'}
                    >
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Livreur</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id} className={selectedIds.has(doc.id) ? 'bg-primary-50' : ''}>
                    <TableCell>
                      <button
                        onClick={() => toggleSelect(doc.id)}
                        className="p-0.5 text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        {selectedIds.has(doc.id) ? (
                          <CheckSquare className="w-4 h-4 text-primary-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                          {doc.profile_photo_url ? (
                            <img src={doc.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{doc.full_name || '-'}</div>
                          <div className="text-xs text-gray-500">{doc.phone}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">{getDocumentCount(doc)} fichier(s)</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        {getStatusBadge(doc.verification_status)}
                        {doc.verification_status === 'rejected' && doc.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={doc.rejection_reason}>
                            {doc.rejection_reason}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(doc.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => {
                          setSelectedDoc(doc);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
                        title="Voir details"
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
          {!loading && documents.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-gray-500">
                {totalCount} document{totalCount > 1 ? 's' : ''} au total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Precedent
                </button>
                <span className="text-sm text-gray-700">
                  Page {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 flex items-center gap-1"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Floating Bulk Action Bar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-3 bg-white border border-gray-200 shadow-xl rounded-xl px-5 py-3">
            <span className="text-sm font-medium text-gray-700">
              {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
            </span>
            <div className="w-px h-6 bg-gray-200" />
            <Button
              className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2"
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {bulkProgress.current}/{bulkProgress.total}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approuver tout
                </>
              )}
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Annuler la selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDoc(null);
        }}
        title="Revue du document"
        size="lg"
      >
        {selectedDoc && (
          <div className="space-y-6">
            {/* Driver info */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {selectedDoc.profile_photo_url ? (
                  <img src={selectedDoc.profile_photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-medium">{selectedDoc.full_name}</p>
                <p className="text-sm text-gray-500">{selectedDoc.phone}</p>
                <p className="text-xs text-gray-400">
                  Soumis le {format(new Date(selectedDoc.created_at), 'dd MMM yyyy a HH:mm', { locale: fr })}
                </p>
              </div>
              <div className="ml-auto">
                {getStatusBadge(selectedDoc.verification_status)}
              </div>
            </div>

            {/* Previous rejection reason */}
            {selectedDoc.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Motif du dernier rejet</p>
                <p className="text-sm text-red-600">{selectedDoc.rejection_reason}</p>
              </div>
            )}

            {/* Document images */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Documents soumis</p>
              <div className="grid grid-cols-2 gap-4">
                {selectedDoc.id_card_front_url && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">CNI - Recto</p>
                    <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedDoc.id_card_front_url}
                        alt="CNI Recto"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(selectedDoc.id_card_front_url!)}
                      />
                    </div>
                  </div>
                )}
                {selectedDoc.id_card_back_url && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">CNI - Verso</p>
                    <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedDoc.id_card_back_url}
                        alt="CNI Verso"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(selectedDoc.id_card_back_url!)}
                      />
                    </div>
                  </div>
                )}
                {selectedDoc.license_front_url && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Permis - Recto</p>
                    <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedDoc.license_front_url}
                        alt="Permis Recto"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(selectedDoc.license_front_url!)}
                      />
                    </div>
                  </div>
                )}
                {selectedDoc.license_back_url && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Permis - Verso</p>
                    <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedDoc.license_back_url}
                        alt="Permis Verso"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(selectedDoc.license_back_url!)}
                      />
                    </div>
                  </div>
                )}
                {selectedDoc.vehicle_registration_url && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Carte grise</p>
                    <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedDoc.vehicle_registration_url}
                        alt="Carte grise"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(selectedDoc.vehicle_registration_url!)}
                      />
                    </div>
                  </div>
                )}
                {selectedDoc.insurance_url && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Assurance</p>
                    <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedDoc.insurance_url}
                        alt="Assurance"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(selectedDoc.insurance_url!)}
                      />
                    </div>
                  </div>
                )}
                {selectedDoc.profile_photo_url && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Photo de profil</p>
                    <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedDoc.profile_photo_url}
                        alt="Photo de profil"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(selectedDoc.profile_photo_url!)}
                      />
                    </div>
                  </div>
                )}
              </div>
              {getDocumentCount(selectedDoc) === 0 && (
                <p className="text-sm text-gray-400 mt-2">Aucun document soumis par ce livreur.</p>
              )}
            </div>

            {/* Actions for pending documents */}
            {selectedDoc.verification_status === 'pending' && (
              <div className="border-t pt-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => openRejectModal(selectedDoc)}
                    disabled={processing}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeter
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(selectedDoc)}
                    disabled={processing}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approuver
                  </Button>
                </div>
              </div>
            )}

            {/* Close for non-pending */}
            {selectedDoc.verification_status !== 'pending' && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Fermer
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectTargetDoc(null);
          setRejectReasonInput('');
          setRejectReasonError('');
        }}
        title="Motif du rejet"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Vous etes sur le point de rejeter les documents de <span className="font-medium">{rejectTargetDoc?.full_name}</span>. Veuillez indiquer le motif du rejet.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motif du rejet <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReasonInput}
              onChange={(e) => {
                setRejectReasonInput(e.target.value);
                if (e.target.value.trim()) setRejectReasonError('');
              }}
              placeholder="Expliquez pourquoi les documents sont rejetes..."
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                rejectReasonError ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              rows={3}
            />
            {rejectReasonError && (
              <p className="text-xs text-red-500 mt-1">{rejectReasonError}</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowRejectModal(false);
                setRejectTargetDoc(null);
                setRejectReasonInput('');
                setRejectReasonError('');
              }}
              disabled={processing}
            >
              Annuler
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectConfirm}
              disabled={processing || !rejectReasonInput.trim()}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Confirmer le rejet
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={previewImage}
            alt="Document"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
