import { useEffect, useState } from 'react';
import { Save, Bell, Shield, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { adminLogger } from '../utils/logger';
import Header from '../components/layout/Header';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { getSettings, updateSettings } from '../services/adminService';

interface SettingsState {
  general: { platform_name: string; contact_email: string; support_phone: string };
  commission: { platform_percent: number; min_commission: number };
  pricing: { base_price: number; price_per_km: number; min_price: number; max_price: number };
  notifications: { new_drivers: boolean; critical_incidents: boolean; new_companies: boolean };
  api: { rate_limit: number; key_expiry_days: number };
}

const DEFAULT_SETTINGS: SettingsState = {
  general: { platform_name: 'LogiTrack Africa', contact_email: 'support@logitrack.africa', support_phone: '+225 07 00 00 00 00' },
  commission: { platform_percent: 15, min_commission: 100 },
  pricing: { base_price: 500, price_per_km: 100, min_price: 500, max_price: 10000 },
  notifications: { new_drivers: true, critical_incidents: true, new_companies: true },
  api: { rate_limit: 100, key_expiry_days: 365 },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings({
        general: { ...DEFAULT_SETTINGS.general, ...(data.general || {}) } as SettingsState['general'],
        commission: { ...DEFAULT_SETTINGS.commission, ...(data.commission || {}) } as SettingsState['commission'],
        pricing: { ...DEFAULT_SETTINGS.pricing, ...(data.pricing || {}) } as SettingsState['pricing'],
        notifications: { ...DEFAULT_SETTINGS.notifications, ...(data.notifications || {}) } as SettingsState['notifications'],
        api: { ...DEFAULT_SETTINGS.api, ...(data.api || {}) } as SettingsState['api'],
      });
    } catch (error) {
      adminLogger.error('Error loading settings', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const keys = ['general', 'commission', 'pricing', 'notifications', 'api'] as const;
      for (const key of keys) {
        const result = await updateSettings(key, settings[key]);
        if (!result.success) {
          setSaveStatus('error');
          setSaving(false);
          return;
        }
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const updateGeneral = (field: keyof SettingsState['general'], value: string) => {
    setSettings(prev => ({ ...prev, general: { ...prev.general, [field]: value } }));
  };

  const updateCommission = (field: keyof SettingsState['commission'], value: number) => {
    setSettings(prev => ({ ...prev, commission: { ...prev.commission, [field]: value } }));
  };

  const updatePricing = (field: keyof SettingsState['pricing'], value: number) => {
    setSettings(prev => ({ ...prev, pricing: { ...prev.pricing, [field]: value } }));
  };

  const updateNotification = (field: keyof SettingsState['notifications'], value: boolean) => {
    setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, [field]: value } }));
  };

  const updateApi = (field: keyof SettingsState['api'], value: number) => {
    setSettings(prev => ({ ...prev, api: { ...prev.api, [field]: value } }));
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Paramètres" subtitle="Configuration de la plateforme LogiTrack Africa" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Paramètres" subtitle="Configuration de la plateforme LogiTrack Africa" />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Save Status */}
        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            <CheckCircle className="w-5 h-5" />
            <span>Paramètres enregistrés avec succès</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <span>Erreur lors de l'enregistrement</span>
          </div>
        )}

        {/* General Settings */}
        <Card>
          <CardHeader
            title="Paramètres généraux"
            subtitle="Configuration de base de la plateforme"
          />
          <div className="space-y-4">
            <Input
              label="Nom de la plateforme"
              value={settings.general.platform_name}
              onChange={(e) => updateGeneral('platform_name', e.target.value)}
              placeholder="Nom affiché"
            />
            <Input
              label="Email de contact"
              type="email"
              value={settings.general.contact_email}
              onChange={(e) => updateGeneral('contact_email', e.target.value)}
              placeholder="support@logitrack.africa"
            />
            <Input
              label="Téléphone de support"
              value={settings.general.support_phone}
              onChange={(e) => updateGeneral('support_phone', e.target.value)}
              placeholder="+225 XX XX XX XX XX"
            />
          </div>
        </Card>

        {/* Commission Settings */}
        <Card>
          <CardHeader
            title="Commission"
            subtitle="Taux de commission par défaut"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Commission plateforme (%)"
              type="number"
              value={settings.commission.platform_percent}
              onChange={(e) => updateCommission('platform_percent', Number(e.target.value))}
              min={0}
              max={100}
              helperText="Pourcentage prélevé sur chaque livraison"
            />
            <Input
              label="Commission minimum (FCFA)"
              type="number"
              value={settings.commission.min_commission}
              onChange={(e) => updateCommission('min_commission', Number(e.target.value))}
              min={0}
              helperText="Montant minimum de commission"
            />
          </div>
        </Card>

        {/* Pricing Settings */}
        <Card>
          <CardHeader
            title="Tarification par défaut"
            subtitle="Tarifs appliqués aux nouvelles zones"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prix de base (FCFA)"
              type="number"
              value={settings.pricing.base_price}
              onChange={(e) => updatePricing('base_price', Number(e.target.value))}
              min={0}
            />
            <Input
              label="Prix par km (FCFA)"
              type="number"
              value={settings.pricing.price_per_km}
              onChange={(e) => updatePricing('price_per_km', Number(e.target.value))}
              min={0}
            />
            <Input
              label="Prix minimum (FCFA)"
              type="number"
              value={settings.pricing.min_price}
              onChange={(e) => updatePricing('min_price', Number(e.target.value))}
              min={0}
            />
            <Input
              label="Prix maximum (FCFA)"
              type="number"
              value={settings.pricing.max_price}
              onChange={(e) => updatePricing('max_price', Number(e.target.value))}
              min={0}
              helperText="0 = pas de limite"
            />
          </div>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader
            title="Notifications"
            subtitle="Configuration des alertes"
          />
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium">Nouveaux livreurs</p>
                  <p className="text-sm text-gray-500">Notification pour les nouvelles inscriptions</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.notifications.new_drivers}
                  onChange={(e) => updateNotification('new_drivers', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium">Incidents critiques</p>
                  <p className="text-sm text-gray-500">Alerte immédiate pour les incidents graves</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.notifications.critical_incidents}
                  onChange={(e) => updateNotification('critical_incidents', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium">Nouvelles entreprises</p>
                  <p className="text-sm text-gray-500">Notification pour les demandes d'inscription</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.notifications.new_companies}
                  onChange={(e) => updateNotification('new_companies', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* API Settings */}
        <Card>
          <CardHeader
            title="API & Sécurité"
            subtitle="Configuration de l'API"
          />
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <Shield className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium">Limite de requêtes</p>
                  <p className="text-sm text-gray-500">Nombre max de requêtes par minute</p>
                </div>
              </div>
              <Input
                type="number"
                value={settings.api.rate_limit}
                onChange={(e) => updateApi('rate_limit', Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <Key className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium">Expiration des clés API</p>
                  <p className="text-sm text-gray-500">Durée de validité (en jours)</p>
                </div>
              </div>
              <Input
                type="number"
                value={settings.api.key_expiry_days}
                onChange={(e) => updateApi('key_expiry_days', Number(e.target.value))}
                className="w-24"
              />
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Enregistrer les modifications
          </Button>
        </div>
      </div>
    </div>
  );
}
