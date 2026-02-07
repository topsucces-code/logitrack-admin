import { useEffect, useState } from 'react';
import { Plus, Search, Building2, Users, Package, CheckCircle, Ban, Eye, AlertCircle } from 'lucide-react';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import {
  getDeliveryCompanies,
  createDeliveryCompany,
  activateDeliveryCompany,
  suspendDeliveryCompany,
  getSettings,
} from '../services/adminService';
import type { DeliveryCompany } from '../types';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<DeliveryCompany | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [defaultCommission, setDefaultCommission] = useState(15);
  const [formData, setFormData] = useState({
    company_name: '',
    legal_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    commission_rate: 15,
  });

  useEffect(() => {
    loadCompanies();
  }, [statusFilter]);

  useEffect(() => {
    getSettings().then((settings) => {
      const rate = settings?.commission?.platform_percent;
      if (typeof rate === 'number') {
        setDefaultCommission(rate);
        setFormData(prev => ({ ...prev, commission_rate: rate }));
      }
    });
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await getDeliveryCompanies(statusFilter || undefined);
      setCompanies(data);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    setCreateError(null);
    const result = await createDeliveryCompany(formData);
    if (result.success) {
      setShowCreateModal(false);
      setFormData({
        company_name: '',
        legal_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        owner_name: '',
        owner_phone: '',
        owner_email: '',
        commission_rate: defaultCommission,
      });
      loadCompanies();
    } else {
      setCreateError(result.error || 'Erreur lors de la création de l\'entreprise');
    }
  };

  const handleActivate = async (id: string) => {
    await activateDeliveryCompany(id);
    loadCompanies();
  };

  const handleSuspend = async (id: string) => {
    await suspendDeliveryCompany(id);
    loadCompanies();
  };

  const filteredCompanies = companies.filter(
    (company) =>
      company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'suspended':
        return <Badge variant="danger">Suspendue</Badge>;
      case 'pending':
        return <Badge variant="warning">En attente</Badge>;
      case 'terminated':
        return <Badge variant="danger">Résiliée</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Entreprises de livraison"
        subtitle="Gérez les entreprises partenaires de livraison"
      />

      <div className="p-6">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une entreprise..."
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
              <option value="active">Active</option>
              <option value="suspended">Suspendue</option>
            </select>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle entreprise
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{companies.length}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {companies.filter((c) => c.status === 'active').length}
                </p>
                <p className="text-sm text-gray-500">Actives</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <Users className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {companies.reduce((sum, c) => sum + (c.total_drivers || 0), 0)}
                </p>
                <p className="text-sm text-gray-500">Livreurs</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                <Package className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {companies.reduce((sum, c) => sum + (c.total_deliveries || 0), 0)}
                </p>
                <p className="text-sm text-gray-500">Livraisons</p>
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Livreurs</TableHead>
                  <TableHead>Livraisons</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                          <Building2 className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium">{company.company_name}</div>
                          <div className="text-xs text-gray-500">{company.city}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{company.email}</div>
                      <div className="text-xs text-gray-500">{company.phone}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{company.total_drivers || 0}</span>
                      <span className="text-gray-500 text-sm ml-1">
                        ({company.active_drivers || 0} actifs)
                      </span>
                    </TableCell>
                    <TableCell>{company.total_deliveries || 0}</TableCell>
                    <TableCell>{company.commission_rate}%</TableCell>
                    <TableCell>{getStatusBadge(company.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedCompany(company);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {company.status === 'pending' && (
                          <button
                            onClick={() => handleActivate(company.id)}
                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg"
                            title="Activer"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {company.status === 'active' && (
                          <button
                            onClick={() => handleSuspend(company.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                            title="Suspendre"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateError(null); }}
        title="Nouvelle entreprise de livraison"
        size="lg"
      >
        {createError && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{createError}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nom commercial"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            placeholder="Ex: Express Livraison"
            required
          />
          <Input
            label="Raison sociale"
            value={formData.legal_name}
            onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
            placeholder="Ex: Express Livraison SARL"
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="contact@entreprise.com"
            required
          />
          <Input
            label="Téléphone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+225 07 00 00 00 00"
            required
          />
          <Input
            label="Adresse"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Rue..."
          />
          <Input
            label="Ville"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="Abidjan"
          />
          <Input
            label="Nom du propriétaire"
            value={formData.owner_name}
            onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
            placeholder="Jean Dupont"
            required
          />
          <Input
            label="Téléphone propriétaire"
            value={formData.owner_phone}
            onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
            placeholder="+225 07 00 00 00 00"
          />
          <Input
            label="Email propriétaire"
            type="email"
            value={formData.owner_email}
            onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
            placeholder="owner@entreprise.com"
          />
          <Input
            label="Taux de commission (%)"
            type="number"
            value={formData.commission_rate}
            onChange={(e) => setFormData({ ...formData, commission_rate: parseInt(e.target.value) })}
            min={0}
            max={100}
          />
        </div>
        <div className="flex justify-end gap-3 pt-6">
          <Button variant="outline" onClick={() => setShowCreateModal(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreateCompany}>Créer l'entreprise</Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedCompany(null);
        }}
        title={selectedCompany?.company_name || 'Détails'}
        size="lg"
      >
        {selectedCompany && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Raison sociale</p>
                <p className="font-medium">{selectedCompany.legal_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Statut</p>
                {getStatusBadge(selectedCompany.status)}
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{selectedCompany.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <p className="font-medium">{selectedCompany.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Propriétaire</p>
                <p className="font-medium">{selectedCompany.owner_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Commission</p>
                <p className="font-medium">{selectedCompany.commission_rate}%</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Statistiques</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold">{selectedCompany.total_drivers || 0}</p>
                  <p className="text-sm text-gray-500">Livreurs</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold">{selectedCompany.total_deliveries || 0}</p>
                  <p className="text-sm text-gray-500">Livraisons</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold">{formatCurrency(selectedCompany.total_earnings || 0)}</p>
                  <p className="text-sm text-gray-500">Gains totaux</p>
                </div>
              </div>
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
