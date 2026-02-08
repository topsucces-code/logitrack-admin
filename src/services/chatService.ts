/**
 * LogiTrack Admin - Chat Support Service
 * Service pour gerer les conversations de support avec les drivers
 */

import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { chatLogger } from '../utils/logger';

// ========================================
// Types
// ========================================

export interface ChatConversation {
  id: string;
  driver_id: string;
  status: 'active' | 'resolved' | 'waiting';
  subject?: string;
  delivery_id?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  driver?: { full_name: string; phone: string };
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: 'driver' | 'support' | 'system';
  sender_id: string;
  sender_name: string;
  message: string;
  message_type: 'text' | 'image' | 'location' | 'delivery_info';
  metadata?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface ConversationStats {
  total: number;
  waiting: number;
  active: number;
  resolved: number;
}

// ========================================
// Conversations
// ========================================

export async function getConversations(statusFilter?: string): Promise<ChatConversation[]> {
  let query = supabase
    .from('logitrack_chat_conversations')
    .select('*, driver:driver_id(full_name, phone)')
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    chatLogger.error('Error fetching conversations', { error });
    return [];
  }
  return (data || []) as ChatConversation[];
}

export async function getConversationStats(): Promise<ConversationStats> {
  const { data, error } = await supabase
    .from('logitrack_chat_conversations')
    .select('status');

  if (error) {
    chatLogger.error('Error fetching conversation stats', { error });
    return { total: 0, waiting: 0, active: 0, resolved: 0 };
  }

  const conversations = data || [];
  return {
    total: conversations.length,
    waiting: conversations.filter(c => c.status === 'waiting').length,
    active: conversations.filter(c => c.status === 'active').length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
  };
}

// ========================================
// Messages
// ========================================

export async function getMessages(conversationId: string, limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('logitrack_chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    chatLogger.error('Error fetching messages', { error });
    return [];
  }

  return ((data || []) as ChatMessage[]).reverse();
}

export async function sendAdminMessage(
  conversationId: string,
  adminId: string,
  adminName: string,
  message: string
): Promise<{ message: ChatMessage | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('logitrack_chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'support',
        sender_id: adminId,
        sender_name: adminName,
        message,
        message_type: 'text',
      })
      .select()
      .single();

    if (error) {
      return { message: null, error: error.message };
    }

    // Update conversation last message + set status active
    await supabase
      .from('logitrack_chat_conversations')
      .update({
        last_message: message.slice(0, 100),
        last_message_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', conversationId);

    return { message: data as ChatMessage, error: null };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { message: null, error: errorMessage };
  }
}

export async function markConversationRead(conversationId: string, adminId: string): Promise<void> {
  try {
    // Mark driver messages as read
    await supabase
      .from('logitrack_chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'driver')
      .is('read_at', null);

    // Reset unread count
    await supabase
      .from('logitrack_chat_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  } catch (err) {
    chatLogger.warn('Failed to mark conversation as read', { error: err, adminId });
  }
}

// ========================================
// Conversation Status
// ========================================

export async function closeConversation(conversationId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_chat_conversations')
    .update({ status: 'resolved', updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function reopenConversation(conversationId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('logitrack_chat_conversations')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ========================================
// Realtime Subscriptions
// ========================================

export function subscribeToConversations(
  onUpdate: (conversation: ChatConversation) => void
): RealtimeChannel {
  const channel = supabase
    .channel('admin_chat_conversations')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'logitrack_chat_conversations',
      },
      (payload) => {
        onUpdate(payload.new as ChatConversation);
      }
    )
    .subscribe();

  return channel;
}

export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: ChatMessage) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`admin_chat_messages_${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'logitrack_chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(payload.new as ChatMessage);
      }
    )
    .subscribe();

  return channel;
}

// ========================================
// Typing Indicator (Realtime Broadcast)
// ========================================

/**
 * Subscribe to typing events for a conversation and get back a channel
 * that can also be used to send typing events (same broadcast channel).
 */
export function subscribeToTyping(
  conversationId: string,
  onTyping: (senderType: string, senderName: string) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`typing_${conversationId}`)
    .on('broadcast', { event: 'typing' }, (payload) => {
      const { sender_type, sender_name } = payload.payload as {
        sender_type: string;
        sender_name: string;
      };
      onTyping(sender_type, sender_name);
    })
    .subscribe();

  return channel;
}

/**
 * Send a typing indicator on an already-subscribed typing channel.
 * The channel must be the one returned by subscribeToTyping.
 */
export function sendTypingIndicator(
  channel: RealtimeChannel,
  senderType: 'support' | 'driver',
  senderName: string
): void {
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { sender_type: senderType, sender_name: senderName },
  });
}

// ========================================
// Global New Message Subscription
// ========================================

export function subscribeToAllNewMessages(
  onMessage: (message: ChatMessage) => void
): RealtimeChannel {
  const channel = supabase
    .channel('admin_all_chat_messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'logitrack_chat_messages',
      },
      (payload) => {
        onMessage(payload.new as ChatMessage);
      }
    )
    .subscribe();

  return channel;
}
