import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, MapPin, AlertCircle, RotateCcw, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useFormAutosave } from '../hooks/useFormAutosave';
import { formatCurrency } from '../utils/format';
import { adminLogger } from '../utils/logger';
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
  const { showSuccess, showError } = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    country: 'Côte d\'Ivoire',
    base_price: 500,
    price_per_km: 100,
    min_price: 500,
    max_price: 0,
  });

  const isModalOpen = showCreateModal || !!editingZone;
  const { hasDraft, restoreDraft, clearDraft, draftSavedAt, justSaved } = useFormAutosave('zone', formData, isModalOpen);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Show draft banner when modal opens and draft exists (only for create, not edit)
  useEffect(() => {
    if (showCreateModal && hasDraft) {
      setShowDraftBanner(true);
    } else if (!isModalOpen) {
      setShowDraftBanner(false);
    }
  }, [showCreateModal, hasDraft, isModalOpen]);

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

  const validateField = (field: string, data = formData): string => {
    switch (field) {
      case 'name':
        if (!data.name.trim()) return 'Le nom de la zone est requis';
        return '';
      case 'city':
        if (!data.city.trim()) return 'La ville est requise';
        return '';
      case 'base_price':
        if (data.base_price < 0) return 'Le prix de base doit être supérieur ou égal à 0';
        return '';
      case 'price_per_km':
        if (data.price_per_km <= 0) return 'Le prix par km doit être supérieur à 0';
        return '';
      case 'min_price':
        if (data.min_price < 0) return 'Le prix minimum doit être supérieur ou égal à 0';
        return '';
      case 'max_price':
        if (data.max_price > 0 && data.max_price < data.min_price)
          return 'Le prix maximum doit être supérieur ou égal au prix minimum';
        return '';
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const fields = ['name', 'city', 'base_price', 'price_per_km', 'min_price', 'max_price'];
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const error = validateField(field);
      if (error) errors[field] = error;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldBlur = (field: string) => {
    const error = validateField(field);
    setFormErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleFieldChange = (field: string, value: string | number) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    // Clear error for this field if it was previously invalid
    if (formErrors[field]) {
      const error = validateField(field, newData);
      setFormErrors((prev) => {
        if (error) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    // Also revalidate max_price when min_price changes (cross-field dependency)
    if (field === 'min_price' && formErrors['max_price']) {
      const maxError = validateField('max_price', newData);
      setFormErrors((prev) => {
        if (maxError) return prev;
        const next = { ...prev };
        delete next['max_price'];
        return next;
      });
    }
  };

  const hasFormErrors = Object.keys(formErrors).length > 0;

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await getZones();
      setZones(data);
    } catch (error) {
      adminLogger.error('Error loading zones', { error });
      setLoadError('Erreur lors du chargement des zones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = async () => {
    setFormError(null);
    if (!validateForm()) return;
    const result = await createZone(formData);
    if (result.success) {
      clearDraft();
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
    if (!validateForm()) return;
    const result = await updateZone(editingZone.id, formData);
    if (result.success) {
      clearDraft();
      setEditingZone(null);
      resetForm();
      loadZones();
    } else {
      setFormError(result.error || 'Erreur lors de la mise à jour de la zone');
    }
  };

  const handleToggleActive = async (zone: Zone) => {
    const result = await updateZone(zone.id, { is_active: !zone.is_active });
    if (!result.success) { showError(result.error || 'Erreur lors de la mise à jour'); return; }
    showSuccess(zone.is_active ? 'Zone désactivée' : 'Zone activée');
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
    setFormErrors({});
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


  return (
    <div className="min-h-screen">
      <Header title="Zones de livraison" subtitle="Gérez les zones et la tarification" />

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
          setFormErrors({});
          resetForm();
        }}
        title={editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
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
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}
          <Input
            label="Nom de la zone"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            onBlur={() => handleFieldBlur('name')}
            placeholder="Ex: Cocody"
            error={formErrors.name}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ville"
              value={formData.city}
              onChange={(e) => handleFieldChange('city', e.target.value)}
              onBlur={() => handleFieldBlur('city')}
              placeholder="Abidjan"
              error={formErrors.city}
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
              onChange={(e) => handleFieldChange('base_price', parseInt(e.target.value) || 0)}
              onBlur={() => handleFieldBlur('base_price')}
              error={formErrors.base_price}
              min={0}
            />
            <Input
              label="Prix par km (FCFA)"
              type="number"
              value={formData.price_per_km}
              onChange={(e) => handleFieldChange('price_per_km', parseInt(e.target.value) || 0)}
              onBlur={() => handleFieldBlur('price_per_km')}
              error={formErrors.price_per_km}
              min={0}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prix minimum (FCFA)"
              type="number"
              value={formData.min_price}
              onChange={(e) => handleFieldChange('min_price', parseInt(e.target.value) || 0)}
              onBlur={() => handleFieldBlur('min_price')}
              error={formErrors.min_price}
              min={0}
            />
            <Input
              label="Prix maximum (FCFA)"
              type="number"
              value={formData.max_price}
              onChange={(e) => handleFieldChange('max_price', parseInt(e.target.value) || 0)}
              onBlur={() => handleFieldBlur('max_price')}
              error={formErrors.max_price}
              min={0}
              helperText="0 = pas de limite"
            />
          </div>
          <div className="flex items-center justify-between pt-4">
            <p className={`text-xs text-gray-400 transition-opacity duration-300 ${justSaved ? 'opacity-100' : 'opacity-0'}`}>
              Brouillon sauvegardé
            </p>
            <div className="flex items-center gap-3">
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
              <Button
                onClick={editingZone ? handleUpdateZone : handleCreateZone}
                disabled={hasFormErrors}
              >
                {editingZone ? 'Enregistrer' : 'Créer la zone'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
