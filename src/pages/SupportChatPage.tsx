import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Phone, X, RotateCcw, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Header from '../components/layout/Header';
import Badge from '../components/ui/Badge';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  getConversations,
  getMessages,
  sendAdminMessage,
  markConversationRead,
  closeConversation,
  reopenConversation,
  subscribeToConversations,
  subscribeToMessages,
  getConversationStats,
  type ChatConversation,
  type ChatMessage,
  type ConversationStats,
} from '../services/chatService';

const statusLabels: Record<string, string> = {
  waiting: 'En attente',
  active: 'Active',
  resolved: 'Résolue',
};

const statusVariants: Record<string, 'warning' | 'success' | 'default'> = {
  waiting: 'warning',
  active: 'success',
  resolved: 'default',
};

export default function SupportChatPage() {
  const { user, adminUser } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState<ConversationStats>({ total: 0, waiting: 0, active: 0, resolved: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedConversation = conversations.find(c => c.id === selectedId);

  // Load conversations
  const loadConversations = useCallback(async () => {
    const [convos, convStats] = await Promise.all([
      getConversations(filter),
      getConversationStats(),
    ]);
    setConversations(convos);
    setStats(convStats);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Subscribe to conversation updates
  useEffect(() => {
    const channel = subscribeToConversations(() => {
      loadConversations();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  // Load messages when conversation selected
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      setLoadingMessages(true);
      const msgs = await getMessages(selectedId!);
      if (!cancelled) {
        setMessages(msgs);
        setLoadingMessages(false);
      }
    }

    loadMessages();

    // Mark as read
    if (user) {
      markConversationRead(selectedId, user.id);
    }

    return () => {
      cancelled = true;
    };
  }, [selectedId, user]);

  // Subscribe to new messages for selected conversation
  useEffect(() => {
    if (!selectedId) return;

    const channel = subscribeToMessages(selectedId, (newMsg) => {
      setMessages(prev => {
        // Deduplicate by ID
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Mark as read if from driver
      if (newMsg.sender_type === 'driver' && user) {
        markConversationRead(selectedId, user.id);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  async function handleSend() {
    if (!newMessage.trim() || !selectedId || !user || !adminUser || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const { error } = await sendAdminMessage(
      selectedId,
      user.id,
      adminUser.full_name,
      messageText
    );

    if (error) {
      setNewMessage(messageText); // Restore message on error
    }

    setSending(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleClose() {
    if (!selectedId) return;
    await closeConversation(selectedId);
    loadConversations();
  }

  async function handleReopen() {
    if (!selectedId) return;
    await reopenConversation(selectedId);
    loadConversations();
  }

  function selectConversation(id: string) {
    setSelectedId(id);
  }

  const tabs = [
    { key: 'all', label: 'Toutes', count: stats.total },
    { key: 'waiting', label: 'En attente', count: stats.waiting },
    { key: 'active', label: 'Actives', count: stats.active },
    { key: 'resolved', label: 'Résolues', count: stats.resolved },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Support Chat" subtitle="Conversations avec les livreurs" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Conversation list */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
          {/* Filter tabs */}
          <div className="flex border-b border-gray-200 px-2 pt-3 pb-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors ${
                  filter === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                    filter === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucune conversation</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedId === conv.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {conv.driver?.full_name || 'Livreur inconnu'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="flex-shrink-0 w-5 h-5 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      {conv.subject && (
                        <p className="text-xs text-gray-500 mt-0.5">{conv.subject}</p>
                      )}
                      {conv.last_message && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{conv.last_message}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant={statusVariants[conv.status]} size="sm">
                        {statusLabels[conv.status]}
                      </Badge>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-gray-400">
                          {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Messages */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Sélectionnez une conversation</p>
                <p className="text-gray-400 text-sm mt-1">Choisissez une conversation dans la liste pour commencer</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {selectedConversation.driver?.full_name || 'Livreur inconnu'}
                      </span>
                      <Badge variant={statusVariants[selectedConversation.status]} size="sm">
                        {statusLabels[selectedConversation.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {selectedConversation.driver?.phone && (
                        <a href={`tel:${selectedConversation.driver.phone}`} className="flex items-center gap-1 hover:text-primary-600">
                          <Phone className="w-3 h-3" />
                          {selectedConversation.driver.phone}
                        </a>
                      )}
                      {selectedConversation.subject && (
                        <span>{selectedConversation.subject}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedConversation.status !== 'resolved' ? (
                    <button
                      onClick={handleClose}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Fermer
                    </button>
                  ) : (
                    <button
                      onClick={handleReopen}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Rouvrir
                    </button>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-400">Aucun message dans cette conversation</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              {selectedConversation.status !== 'resolved' && (
                <div className="bg-white border-t border-gray-200 px-6 py-3">
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Tapez votre message..."
                      rows={1}
                      className="flex-1 resize-none px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sending}
                      className="flex-shrink-0 p-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">Entrée pour envoyer, Shift+Entrée pour retour à la ligne</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// Message Bubble Component
// ========================================

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.sender_type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-full">
          {message.message}
        </div>
      </div>
    );
  }

  const isSupport = message.sender_type === 'support';

  return (
    <div className={`flex ${isSupport ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isSupport ? 'order-1' : ''}`}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
          isSupport
            ? 'bg-primary-500 text-white rounded-br-md'
            : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
        }`}>
          {message.message}
        </div>
        <div className={`flex items-center gap-1.5 mt-1 ${isSupport ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-gray-400">{message.sender_name}</span>
          <Clock className="w-2.5 h-2.5 text-gray-300" />
          <span className="text-[10px] text-gray-400">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: fr })}
          </span>
        </div>
      </div>
    </div>
  );
}
