import { useState } from 'react';
import { Save, Bell, Shield, Key } from 'lucide-react';
import Header from '../components/layout/Header';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  return (
    <div className="min-h-screen">
      <Header title="Paramètres" subtitle="Configuration de la plateforme LogiTrack Africa" />

      <div className="p-6 max-w-4xl space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader
            title="Paramètres généraux"
            subtitle="Configuration de base de la plateforme"
          />
          <div className="space-y-4">
            <Input
              label="Nom de la plateforme"
              defaultValue="LogiTrack Africa"
              placeholder="Nom affiché"
            />
            <Input
              label="Email de contact"
              type="email"
              defaultValue="support@logitrack.africa"
              placeholder="support@logitrack.africa"
            />
            <Input
              label="Téléphone de support"
              defaultValue="+225 07 00 00 00 00"
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
              defaultValue={15}
              min={0}
              max={100}
              helperText="Pourcentage prélevé sur chaque livraison"
            />
            <Input
              label="Commission minimum (FCFA)"
              type="number"
              defaultValue={100}
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
              defaultValue={500}
              min={0}
            />
            <Input
              label="Prix par km (FCFA)"
              type="number"
              defaultValue={100}
              min={0}
            />
            <Input
              label="Prix minimum (FCFA)"
              type="number"
              defaultValue={500}
              min={0}
            />
            <Input
              label="Prix maximum (FCFA)"
              type="number"
              defaultValue={10000}
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
                <input type="checkbox" className="sr-only peer" defaultChecked />
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
                <input type="checkbox" className="sr-only peer" defaultChecked />
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
                <input type="checkbox" className="sr-only peer" defaultChecked />
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
                defaultValue={100}
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
                defaultValue={365}
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
