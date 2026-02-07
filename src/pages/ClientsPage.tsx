import { useEffect, useState } from 'react';
import { Plus, Search, Key, Ban, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await getBusinessClients();
      setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    setCreateError(null);
    const result = await createBusinessClient(formData);
    if (result.success) {
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
    if (client.status === 'active') {
      await suspendBusinessClient(client.id);
    } else {
      await activateBusinessClient(client.id);
    }
    loadClients();
  };

  const filteredClients = clients.filter(
    (client) =>
      client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.contact_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau client
          </Button>
        </div>

        {/* Table */}
        <Card padding="none">
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
                {filteredClients.map((client) => (
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
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateClient}>Créer le client</Button>
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
