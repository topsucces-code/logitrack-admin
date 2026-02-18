import { useCallback, useEffect, useState } from 'react';
import { Save, Bell, Shield, Key, Loader2, CheckCircle, AlertCircle, BellRing, Sun, Moon, Palette } from 'lucide-react';
import { adminLogger } from '../utils/logger';
import Header from '../components/layout/Header';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { getSettings, updateSettings } from '../services/adminService';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsState {
  general: { platform_name: string; contact_email: string; support_phone: string };
  commission: { platform_percent: number; min_commission: number };
  pricing: { base_price: number; price_per_km: number; min_price: number; max_price: number };
  notifications: { new_drivers: boolean; critical_incidents: boolean; new_companies: boolean };
  api: { rate_limit: number; key_expiry_days: number };
  branding: { header_color: string };
}

const DEFAULT_SETTINGS: SettingsState = {
  general: { platform_name: 'LogiTrack Africa', contact_email: 'support@logitrack.africa', support_phone: '+225 07 00 00 00 00' },
  commission: { platform_percent: 15, min_commission: 100 },
  pricing: { base_price: 500, price_per_km: 100, min_price: 500, max_price: 10000 },
  notifications: { new_drivers: true, critical_incidents: true, new_companies: true },
  api: { rate_limit: 100, key_expiry_days: 365 },
  branding: { header_color: '#f97316' },
};

export default function SettingsPage() {
  const { isDark, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [notifToast, setNotifToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testingNotif, setTestingNotif] = useState<string | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const showNotifToast = useCallback((type: 'success' | 'error', message: string) => {
    setNotifToast({ type, message });
    setTimeout(() => setNotifToast(null), 3000);
  }, []);

  const requestNotifPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      showNotifToast('error', 'Notifications non supportées par ce navigateur');
      return false;
    }
    setRequestingPermission(true);
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === 'granted') {
        showNotifToast('success', 'Notifications activées');
        return true;
      } else if (permission === 'denied') {
        showNotifToast('error', 'Notifications bloquées par le navigateur');
        return false;
      }
      return false;
    } finally {
      setRequestingPermission(false);
    }
  }, [showNotifToast]);

  const sendTestNotification = useCallback(async (type: string, label: string) => {
    setTestingNotif(type);
    try {
      if (typeof Notification === 'undefined') {
        showNotifToast('error', 'Notifications non supportées par ce navigateur');
        return;
      }
      if (Notification.permission !== 'granted') {
        const granted = await requestNotifPermission();
        if (!granted) return;
      }
      new Notification('LogiTrack Admin', {
        body: `Test notification - ${label}`,
        icon: '/favicon.ico',
      });
      showNotifToast('success', 'Notification test envoyée');
    } catch (error) {
      adminLogger.error('Error sending test notification', { error });
      showNotifToast('error', 'Erreur lors de l\'envoi de la notification');
    } finally {
      setTestingNotif(null);
    }
  }, [showNotifToast, requestNotifPermission]);

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
        branding: { ...DEFAULT_SETTINGS.branding, ...(data.branding || {}) } as SettingsState['branding'],
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
      const keys = ['general', 'commission', 'pricing', 'notifications', 'api', 'branding'] as const;
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

  const updateBranding = (field: keyof SettingsState['branding'], value: string) => {
    setSettings(prev => ({ ...prev, branding: { ...prev.branding, [field]: value } }));
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

        {/* Appearance */}
        <Card>
          <CardHeader
            title="Apparence"
            subtitle="Personnalisation de l'interface"
          />
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center">
              {isDark ? (
                <Moon className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3" />
              ) : (
                <Sun className="w-5 h-5 text-gray-400 mr-3" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Mode sombre</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isDark ? 'Le mode sombre est activé' : 'Le mode clair est activé'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isDark}
                onChange={toggleTheme}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          {/* Header Color */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
            <div className="flex items-center mb-3">
              <Palette className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Couleur du header (app livreur)</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Couleur d'arrière-plan du header dans l'application livreur
                </p>
              </div>
            </div>

            {/* Preview */}
            <div
              className="rounded-lg p-3 mb-3 text-white text-sm font-medium"
              style={{ backgroundColor: settings.branding.header_color }}
            >
              Aperçu du header livreur
            </div>

            {/* Color picker + hex input */}
            <div className="flex items-center gap-3 mb-3">
              <input
                type="color"
                value={settings.branding.header_color}
                onChange={(e) => updateBranding('header_color', e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer p-0.5"
              />
              <Input
                label="Code couleur"
                value={settings.branding.header_color}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateBranding('header_color', v);
                }}
                placeholder="#f97316"
                className="w-32"
              />
            </div>

            {/* Preset colors */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Presets :</span>
              {[
                { color: '#f97316', label: 'Orange' },
                { color: '#3b82f6', label: 'Bleu' },
                { color: '#10b981', label: 'Vert' },
                { color: '#ef4444', label: 'Rouge' },
                { color: '#8b5cf6', label: 'Violet' },
                { color: '#06b6d4', label: 'Cyan' },
                { color: '#f59e0b', label: 'Ambre' },
                { color: '#ec4899', label: 'Rose' },
              ].map(({ color, label }) => (
                <button
                  key={color}
                  onClick={() => updateBranding('header_color', color)}
                  title={label}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    settings.branding.header_color === color
                      ? 'border-gray-900 dark:border-white scale-110'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </Card>

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
            {/* Notification Toast */}
            {notifToast && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                notifToast.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {notifToast.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{notifToast.message}</span>
              </div>
            )}

            {/* Permission Status Banner */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Notifications du navigateur</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      notifPermission === 'granted'
                        ? 'bg-green-500'
                        : notifPermission === 'denied'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                    }`} />
                    <span className={`text-xs ${
                      notifPermission === 'granted'
                        ? 'text-green-600'
                        : notifPermission === 'denied'
                          ? 'text-red-600'
                          : 'text-gray-500'
                    }`}>
                      {notifPermission === 'granted'
                        ? 'Autorisées'
                        : notifPermission === 'denied'
                          ? 'Bloquées'
                          : 'Non configurées'}
                    </span>
                  </div>
                </div>
              </div>
              {notifPermission !== 'granted' && (
                <button
                  onClick={requestNotifPermission}
                  disabled={requestingPermission || notifPermission === 'denied'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    notifPermission === 'denied'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  {requestingPermission && <Loader2 className="w-3 h-3 animate-spin" />}
                  Activer les notifications
                </button>
              )}
            </div>

            {/* Notification Toggles */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium">Nouveaux livreurs</p>
                  <p className="text-sm text-gray-500">Notification pour les nouvelles inscriptions</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => sendTestNotification('new_drivers', 'Nouveaux livreurs')}
                  disabled={testingNotif === 'new_drivers'}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  {testingNotif === 'new_drivers' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  Tester
                </button>
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
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium">Incidents critiques</p>
                  <p className="text-sm text-gray-500">Alerte immédiate pour les incidents graves</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => sendTestNotification('critical_incidents', 'Incidents critiques')}
                  disabled={testingNotif === 'critical_incidents'}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  {testingNotif === 'critical_incidents' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  Tester
                </button>
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
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium">Nouvelles entreprises</p>
                  <p className="text-sm text-gray-500">Notification pour les demandes d'inscription</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => sendTestNotification('new_companies', 'Nouvelles entreprises')}
                  disabled={testingNotif === 'new_companies'}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  {testingNotif === 'new_companies' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  Tester
                </button>
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
