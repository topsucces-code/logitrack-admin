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

interface IdentityDocument {
  id: string;
  driver_id: string;
  document_type: string;
  front_image_url: string;
  back_image_url?: string;
  selfie_url: string;
  verification_status: string;
  verification_score?: number;
  face_match_score?: number;
  document_authenticity_score?: number;
  document_number?: string;
  rejection_reason?: string;
  created_at: string;
  verified_at?: string;
  driver?: {
    full_name: string;
    phone: string;
    photo_url?: string;
  };
}

export default function DocumentReviewPage() {
  const { showSuccess, showError } = useToast();
  const [documents, setDocuments] = useState<IdentityDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedDoc, setSelectedDoc] = useState<IdentityDocument | null>(null);
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
      .from('identity_documents')
      .select('*, driver:drivers(full_name, phone, photo_url)')
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
    setDocuments((data as IdentityDocument[]) || []);
    setLoading(false);
  }

  async function handleApprove(doc: IdentityDocument) {
    setProcessing(true);

    try {
      const { error: docError } = await supabase
        .from('identity_documents')
        .update({
          verification_status: 'verified',
          verification_score: 100,
          verified_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (docError) throw docError;

      const { error: driverError } = await supabase
        .from('logitrack_drivers')
        .update({
          is_identity_verified: true,
          verification_status: 'verified',
        })
        .eq('id', doc.driver_id);

      if (driverError) throw driverError;

      const { error: badgeError } = await supabase
        .from('driver_badges')
        .upsert({
          driver_id: doc.driver_id,
          badge_id: 'verified_identity',
          name: 'Identité Vérifiée',
          description: 'Document d\'identité vérifié avec succès',
          icon: '✓',
          earned_at: new Date().toISOString(),
        });

      if (badgeError) {
        adminLogger.error('Error upserting driver badge', { error: badgeError });
      }

      showSuccess('Document approuvé');
      setShowModal(false);
      loadDocuments();
    } catch (err) {
      adminLogger.error('Error approving document', { error: err });
      showError('Erreur lors de l\'approbation du document');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(doc: IdentityDocument) {
    if (!rejectionReason.trim()) return;

    setProcessing(true);

    try {
      const { error: docError } = await supabase
        .from('identity_documents')
        .update({
          verification_status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', doc.id);

      if (docError) throw docError;

      const { error: driverError } = await supabase
        .from('logitrack_drivers')
        .update({ verification_status: 'rejected' })
        .eq('id', doc.driver_id);

      if (driverError) throw driverError;

      showSuccess('Document rejeté');
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
      case 'processing':
        return <Badge variant="info">En traitement</Badge>;
      case 'verified':
        return <Badge variant="success">Vérifié</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejeté</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  }

  function getDocTypeLabel(type: string) {
    switch (type) {
      case 'cni': return 'CNI';
      case 'passport': return 'Passeport';
      case 'permis': return 'Permis';
      case 'carte_consulaire': return 'Carte Consulaire';
      default: return type;
    }
  }

  const stats = {
    pending: documents.filter(d => d.verification_status === 'pending').length,
    verified: documents.filter(d => d.verification_status === 'verified').length,
    rejected: documents.filter(d => d.verification_status === 'rejected').length,
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Vérification des documents"
        subtitle="Revue des documents d'identité des livreurs"
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
            <option value="verified">Vérifiés</option>
            <option value="rejected">Rejetés</option>
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
                <p className="text-sm text-gray-500">Vérifiés</p>
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
                <p className="text-sm text-gray-500">Rejetés</p>
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
              <p>Aucun document trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Livreur</TableHead>
                  <TableHead>Type</TableHead>
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
                          {doc.driver?.photo_url ? (
                            <img src={doc.driver.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{doc.driver?.full_name || '-'}</div>
                          <div className="text-xs text-gray-500">{doc.driver?.phone}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getDocTypeLabel(doc.document_type)}</TableCell>
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
                {selectedDoc.driver?.photo_url ? (
                  <img src={selectedDoc.driver.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-medium">{selectedDoc.driver?.full_name}</p>
                <p className="text-sm text-gray-500">{selectedDoc.driver?.phone}</p>
                <p className="text-xs text-gray-400">
                  Type: {getDocTypeLabel(selectedDoc.document_type)} | Soumis le {format(new Date(selectedDoc.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
              <div className="ml-auto">
                {getStatusBadge(selectedDoc.verification_status)}
              </div>
            </div>

            {/* Document images */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Recto</p>
                <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedDoc.front_image_url}
                    alt="Recto"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                    onClick={() => window.open(selectedDoc.front_image_url, '_blank')}
                  />
                </div>
              </div>
              {selectedDoc.back_image_url && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Verso</p>
                  <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={selectedDoc.back_image_url}
                      alt="Verso"
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                      onClick={() => window.open(selectedDoc.back_image_url!, '_blank')}
                    />
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Selfie</p>
                <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedDoc.selfie_url}
                    alt="Selfie"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                    onClick={() => window.open(selectedDoc.selfie_url, '_blank')}
                  />
                </div>
              </div>
            </div>

            {/* Previous scores if any */}
            {selectedDoc.verification_score && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Scores</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold">{selectedDoc.verification_score}%</p>
                    <p className="text-xs text-gray-500">Global</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{selectedDoc.face_match_score || '-'}%</p>
                    <p className="text-xs text-gray-500">Visage</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{selectedDoc.document_authenticity_score || '-'}%</p>
                    <p className="text-xs text-gray-500">Authenticité</p>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection reason (if rejected) */}
            {selectedDoc.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-700">Raison du rejet</p>
                <p className="text-sm text-red-600">{selectedDoc.rejection_reason}</p>
              </div>
            )}

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
                    placeholder="Ex: Photo floue, document expiré, visage non visible..."
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
