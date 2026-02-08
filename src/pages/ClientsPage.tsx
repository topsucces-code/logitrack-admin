import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Search, Key, Ban, CheckCircle, AlertCircle, Loader2, RotateCcw, X } from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useFormAutosave } from '../hooks/useFormAutosave';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useToast } from '../contexts/ToastContext';
import { adminLogger } from '../utils/logger';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import {
  getBusinessClients,
  createBusinessClient,
  createApiKey,
  suspendBusinessClient,
  activateBusinessClient,
} from '../services/adminService';
import type { BusinessClient } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ClientsPage() {
  const { showSuccess, showError } = useToast();
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<BusinessClient | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    company_name: string;
    contact_email: string;
    contact_phone: string;
    webhook_url: string;
    plan: 'starter' | 'business' | 'enterprise';
  }>({
    company_name: '',
    contact_email: '',
    contact_phone: '',
    webhook_url: '',
    plan: 'starter',
  });

  const { hasDraft, restoreDraft, clearDraft, draftSavedAt, justSaved } = useFormAutosave('client', formData, showCreateModal);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Track initial form data to compute isDirty
  const initialFormDataRef = useRef(formData);
  useEffect(() => {
    if (showCreateModal) {
      initialFormDataRef.current = formData;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal]);

  const isDirty = showCreateModal && JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
  useUnsavedChanges(isDirty);

  useEffect(() => {
    if (showCreateModal && hasDraft) {
      setShowDraftBanner(true);
    } else if (!showCreateModal) {
      setShowDraftBanner(false);
    }
  }, [showCreateModal, hasDraft]);

  const handleRestoreDraft = () => {
    const draft = restoreDraft();
    if (draft) setFormData(draft);
    setShowDraftBanner(false);
  };

  const handleIgnoreDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
  };

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return '';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "a l'instant";
    if (diffMin === 1) return 'il y a 1 minute';
    if (diffMin < 60) return `il y a ${diffMin} minutes`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH === 1) return 'il y a 1 heure';
    return `il y a ${diffH} heures`;
  };

  const isSearching = searchQuery !== debouncedSearch;

  useKeyboardShortcuts({
    onSearch: useCallback(() => searchInputRef.current?.focus(), []),
    onEscape: useCallback(() => {
      if (showCreateModal) {
        setShowCreateModal(false);
        setCreateError(null);
      } else if (showApiKeyModal) {
        setShowApiKeyModal(false);
        setNewApiKey(null);
        setSelectedClient(null);
        setApiKeyError(null);
      } else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, [showCreateModal, showApiKeyModal]),
  });

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  useEffect(() => {
    loadClients();
  }, [debouncedSearch, page]);

  const loadClients = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, total } = await getBusinessClients({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: debouncedSearch || undefined,
      });
      setClients(data);
      setTotalCount(total);
    } catch (error) {
      adminLogger.error('Error loading clients', { error });
      setLoadError('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    setCreateError(null);
    const result = await createBusinessClient(formData);
    if (result.success) {
      clearDraft();
      setShowCreateModal(false);
      setFormData({ company_name: '', contact_email: '', contact_phone: '', webhook_url: '', plan: 'starter' as const });
      loadClients();
    } else {
      setCreateError(result.error || 'Erreur lors de la création du client');
    }
  };

  const handleGenerateApiKey = async () => {
    if (!selectedClient) return;
    setGeneratingKey(true);
    setApiKeyError(null);
    const result = await createApiKey(selectedClient.id, 'Production Key', 'live');
    if (result.success && result.apiKey) {
      setNewApiKey(result.apiKey);
    } else {
      setApiKeyError(result.error || 'Erreur lors de la génération de la clé API');
    }
    setGeneratingKey(false);
  };

  const handleToggleStatus = async (client: BusinessClient) => {
    const result = client.status === 'active'
      ? await suspendBusinessClient(client.id)
      : await activateBusinessClient(client.id);
    if (!result.success) {
      showError(result.error || 'Erreur lors du changement de statut');
      return;
    }
    showSuccess(client.status === 'active' ? 'Client suspendu' : 'Client activé');
    loadClients();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Actif</Badge>;
      case 'suspended':
        return <Badge variant="danger">Suspendu</Badge>;
      case 'pending':
        return <Badge variant="warning">En attente</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return <Badge variant="info">Enterprise</Badge>;
      case 'business':
        return <Badge variant="success">Business</Badge>;
      default:
        return <Badge>Starter</Badge>;
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Clients API" subtitle="Gérez les entreprises utilisant l'API LogiTrack" />

      <div className="p-6">
        {loadError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher un client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau client
          </Button>
        </div>

        {/* Result count */}
        {debouncedSearch && !loading && (
          <p className="text-xs text-gray-500 mb-2">
            {totalCount} client{totalCount > 1 ? 's' : ''} trouvé{totalCount > 1 ? 's' : ''}
          </p>
        )}

        {/* Table */}
        <Card padding="none">
          <div className={`transition-opacity duration-200 ${isSearching ? 'opacity-60' : 'opacity-100'}`}>
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="font-medium">{client.company_name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{client.contact_email}</div>
                      {client.contact_phone && (
                        <div className="text-xs text-gray-500">{client.contact_phone}</div>
                      )}
                    </TableCell>
                    <TableCell>{getPlanBadge(client.plan)}</TableCell>
                    <TableCell>{getStatusBadge(client.status)}</TableCell>
                    <TableCell>
                      {format(new Date(client.created_at), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setShowApiKeyModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
                          title="Gérer les clés API"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(client)}
                          className={`p-1.5 rounded-lg ${
                            client.status === 'active'
                              ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
                          }`}
                          title={client.status === 'active' ? 'Suspendre' : 'Activer'}
                        >
                          {client.status === 'active' ? (
                            <Ban className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </button>
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
              {totalCount} client{totalCount > 1 ? 's' : ''} au total
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
          </div>
        </Card>
      </div>

      {/* Create Client Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateError(null); }}
        title="Nouveau client API"
        size="md"
      >
        <div className="space-y-4">
          {showDraftBanner && (
            <div className="flex items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                Brouillon sauvegardé {formatTimeAgo(draftSavedAt)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRestoreDraft}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurer
                </button>
                <button
                  onClick={handleIgnoreDraft}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                  Ignorer
                </button>
              </div>
            </div>
          )}
          {createError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{createError}</p>
            </div>
          )}
          <Input
            label="Nom de l'entreprise"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            placeholder="Ex: Mientior Commerce"
            required
          />
          <Input
            label="Email de contact"
            type="email"
            value={formData.contact_email}
            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            placeholder="contact@entreprise.com"
            required
          />
          <Input
            label="Téléphone"
            value={formData.contact_phone}
            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            placeholder="+225 07 00 00 00 00"
          />
          <Input
            label="URL Webhook"
            value={formData.webhook_url}
            onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
            placeholder="https://api.entreprise.com/webhooks/logitrack"
          />
          <Select
            label="Plan"
            value={formData.plan}
            onChange={(e) => setFormData({ ...formData, plan: e.target.value as 'starter' | 'business' | 'enterprise' })}
            options={[
              { value: 'starter', label: 'Starter' },
              { value: 'business', label: 'Business' },
              { value: 'enterprise', label: 'Enterprise' },
            ]}
          />
          <div className="flex items-center justify-between pt-4">
            <p className={`text-xs text-gray-400 transition-opacity duration-300 ${justSaved ? 'opacity-100' : 'opacity-0'}`}>
              Brouillon sauvegardé
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateClient}>Créer le client</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* API Key Modal */}
      <Modal
        isOpen={showApiKeyModal}
        onClose={() => {
          setShowApiKeyModal(false);
          setNewApiKey(null);
          setSelectedClient(null);
          setApiKeyError(null);
        }}
        title={`Clés API - ${selectedClient?.company_name}`}
        size="md"
      >
        <div className="space-y-4">
          {newApiKey ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium mb-2">
                Clé API générée avec succès !
              </p>
              <p className="text-xs text-green-600 mb-2">
                Copiez cette clé maintenant, elle ne sera plus visible après fermeture.
              </p>
              <code className="block p-2 bg-white rounded border text-xs break-all">
                {newApiKey}
              </code>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Générez une nouvelle clé API pour permettre à ce client d'accéder à l'API LogiTrack.
              </p>
              {apiKeyError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{apiKeyError}</p>
                </div>
              )}
              <Button onClick={handleGenerateApiKey} className="w-full" disabled={generatingKey}>
                {generatingKey ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Key className="w-4 h-4 mr-2" />
                )}
                {generatingKey ? 'Génération en cours...' : 'Générer une nouvelle clé API'}
              </Button>
            </>
          )}
          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowApiKeyModal(false);
                setNewApiKey(null);
                setSelectedClient(null);
              }}
            >
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
