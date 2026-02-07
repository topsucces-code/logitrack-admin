import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, MapPin, AlertCircle } from 'lucide-react';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { getZones, createZone, updateZone } from '../services/adminService';
import type { Zone } from '../types';

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    country: 'Côte d\'Ivoire',
    base_price: 500,
    price_per_km: 100,
    min_price: 500,
    max_price: 0,
  });

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await getZones();
      setZones(data);
    } catch (error) {
      console.error('Error loading zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = async () => {
    setFormError(null);
    const result = await createZone(formData);
    if (result.success) {
      setShowCreateModal(false);
      resetForm();
      loadZones();
    } else {
      setFormError(result.error || 'Erreur lors de la création de la zone');
    }
  };

  const handleUpdateZone = async () => {
    if (!editingZone) return;
    setFormError(null);
    const result = await updateZone(editingZone.id, formData);
    if (result.success) {
      setEditingZone(null);
      resetForm();
      loadZones();
    } else {
      setFormError(result.error || 'Erreur lors de la mise à jour de la zone');
    }
  };

  const handleToggleActive = async (zone: Zone) => {
    await updateZone(zone.id, { is_active: !zone.is_active });
    loadZones();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      city: '',
      country: 'Côte d\'Ivoire',
      base_price: 500,
      price_per_km: 100,
      min_price: 500,
      max_price: 0,
    });
  };

  const openEditModal = (zone: Zone) => {
    setFormData({
      name: zone.name,
      city: zone.city,
      country: zone.country,
      base_price: zone.base_price,
      price_per_km: zone.price_per_km,
      min_price: zone.min_price,
      max_price: zone.max_price || 0,
    });
    setEditingZone(zone);
  };

  const filteredZones = zones.filter(
    (zone) =>
      zone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      zone.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen">
      <Header title="Zones de livraison" subtitle="Gérez les zones et la tarification" />

      <div className="p-6">
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle zone
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
                  <TableHead>Zone</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Prix de base</TableHead>
                  <TableHead>Prix/km</TableHead>
                  <TableHead>Prix min</TableHead>
                  <TableHead>Prix max</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredZones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                          <MapPin className="w-4 h-4 text-primary-600" />
                        </div>
                        <span className="font-medium">{zone.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{zone.city}</TableCell>
                    <TableCell>{formatCurrency(zone.base_price)}</TableCell>
                    <TableCell>{formatCurrency(zone.price_per_km)}</TableCell>
                    <TableCell>{formatCurrency(zone.min_price)}</TableCell>
                    <TableCell>{zone.max_price ? formatCurrency(zone.max_price) : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={zone.is_active ? 'success' : 'default'}>
                        {zone.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(zone)}
                          className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(zone)}
                          className={`px-2 py-1 text-xs rounded ${
                            zone.is_active
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {zone.is_active ? 'Désactiver' : 'Activer'}
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || !!editingZone}
        onClose={() => {
          setShowCreateModal(false);
          setEditingZone(null);
          setFormError(null);
          resetForm();
        }}
        title={editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}
          <Input
            label="Nom de la zone"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Cocody"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ville"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Abidjan"
              required
            />
            <Input
              label="Pays"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="Côte d'Ivoire"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prix de base (FCFA)"
              type="number"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: parseInt(e.target.value) || 0 })}
              min={0}
            />
            <Input
              label="Prix par km (FCFA)"
              type="number"
              value={formData.price_per_km}
              onChange={(e) => setFormData({ ...formData, price_per_km: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prix minimum (FCFA)"
              type="number"
              value={formData.min_price}
              onChange={(e) => setFormData({ ...formData, min_price: parseInt(e.target.value) || 0 })}
              min={0}
            />
            <Input
              label="Prix maximum (FCFA)"
              type="number"
              value={formData.max_price}
              onChange={(e) => setFormData({ ...formData, max_price: parseInt(e.target.value) || 0 })}
              min={0}
              helperText="0 = pas de limite"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setEditingZone(null);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button onClick={editingZone ? handleUpdateZone : handleCreateZone}>
              {editingZone ? 'Enregistrer' : 'Créer la zone'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
