import { useEffect, useState } from 'react';
import { Eye, CheckCircle, XCircle, Clock, FileText, User, AlertCircle } from 'lucide-react';
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
  created_at: string;
}

export default function DocumentReviewPage() {
  const { showSuccess, showError } = useToast();
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedDoc, setSelectedDoc] = useState<DriverDocument | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [statusFilter]);

  async function loadDocuments() {
    setLoading(true);
    let query = supabase
      .from('logitrack_drivers')
      .select('id, full_name, phone, profile_photo_url, id_card_front_url, id_card_back_url, license_front_url, license_back_url, vehicle_registration_url, insurance_url, verification_status, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter) {
      query = query.eq('verification_status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      adminLogger.error('Error loading documents', { error });
      setLoadError('Erreur lors du chargement des documents');
    } else {
      setLoadError(null);
    }
    setDocuments((data as DriverDocument[]) || []);
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
        })
        .eq('id', doc.id);

      if (error) throw error;

      showSuccess('Document approuve');
      setShowModal(false);
      loadDocuments();
    } catch (err) {
      adminLogger.error('Error approving document', { error: err });
      showError('Erreur lors de l\'approbation du document');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(doc: DriverDocument) {
    if (!rejectionReason.trim()) return;

    setProcessing(true);

    try {
      const { error } = await supabase
        .from('logitrack_drivers')
        .update({
          verification_status: 'rejected',
          status: 'rejected',
        })
        .eq('id', doc.id);

      if (error) throw error;

      showSuccess('Document rejete');
      setShowModal(false);
      setRejectionReason('');
      loadDocuments();
    } catch (err) {
      adminLogger.error('Error rejecting document', { error: err });
      showError('Erreur lors du rejet du document');
    } finally {
      setProcessing(false);
    }
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

  const stats = {
    pending: documents.filter(d => d.verification_status === 'pending').length,
    verified: documents.filter(d => d.verification_status === 'verified').length,
    rejected: documents.filter(d => d.verification_status === 'rejected').length,
  };

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
                  <TableHead>Livreur</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
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
                    <TableCell>{getStatusBadge(doc.verification_status)}</TableCell>
                    <TableCell>
                      {format(new Date(doc.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => {
                          setSelectedDoc(doc);
                          setShowModal(true);
                          setRejectionReason('');
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
        </Card>
      </div>

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
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => window.open(selectedDoc.id_card_front_url!, '_blank')}
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
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => window.open(selectedDoc.id_card_back_url!, '_blank')}
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
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => window.open(selectedDoc.license_front_url!, '_blank')}
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
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => window.open(selectedDoc.license_back_url!, '_blank')}
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
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => window.open(selectedDoc.vehicle_registration_url!, '_blank')}
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
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => window.open(selectedDoc.insurance_url!, '_blank')}
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
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => window.open(selectedDoc.profile_photo_url!, '_blank')}
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
              <div className="border-t pt-4 space-y-3">
                {/* Rejection reason input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Raison du rejet (si applicable)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: Photo floue, document expire, visage non visible..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleReject(selectedDoc)}
                    disabled={!rejectionReason.trim() || processing}
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
    </div>
  );
}
