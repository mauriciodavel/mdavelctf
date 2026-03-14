'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import { MessageCircle, Send, X, Minimize2, Maximize2, Copy, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface MiniChatProps {
  team: { id: string; name: string; code: string };
  onClose: () => void;
}

export default function MiniChat({ team, onClose }: MiniChatProps) {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();

  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const profileCacheRef = useRef<Record<string, string>>({});

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profiles(display_name)')
      .eq('team_id', team.id)
      .order('sent_at', { ascending: true })
      .limit(50);
    if (data) {
      setMessages((prev) => {
        if (
          prev.length === data.length &&
          prev.length > 0 &&
          prev[prev.length - 1]?.id === data[data.length - 1]?.id
        ) {
          return prev;
        }
        return data;
      });
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [team.id, supabase]);

  useEffect(() => {
    if (!profile?.id) return;

    const setup = async () => {
      const { data: members } = await supabase
        .from('team_members')
        .select('*, profiles(display_name)')
        .eq('team_id', team.id);
      setMemberCount((members || []).length);
      const cache: Record<string, string> = {};
      (members || []).forEach((m: any) => {
        cache[m.user_id] = m.profiles?.display_name || '?';
      });
      profileCacheRef.current = cache;

      await loadMessages();

      pollIntervalRef.current = setInterval(() => loadMessages(), 3000);

      try {
        const channel = supabase
          .channel(`mini-chat-${team.id}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `team_id=eq.${team.id}`,
            },
            () => loadMessages()
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED' && pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = setInterval(() => loadMessages(), 10000);
            }
          });
        channelRef.current = channel;
      } catch {
        // Realtime not available, polling handles it
      }
    };

    setup();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [profile?.id, team.id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !profile) return;
    const msg = newMessage.trim();
    setNewMessage('');

    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      team_id: team.id,
      user_id: profile.id,
      message: msg,
      sent_at: new Date().toISOString(),
      profiles: { display_name: profile.display_name },
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const { error } = await supabase
      .from('chat_messages')
      .insert({ team_id: team.id, user_id: profile.id, message: msg });
    if (error) {
      toast.error(error.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      return;
    }
    await loadMessages();
  };

  // Collapsed: floating button
  if (!expanded) {
    return (
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        <button
          onClick={() => setExpanded(true)}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-purple
            shadow-lg shadow-cyber-cyan/30 flex items-center justify-center
            hover:scale-110 transition-transform duration-200 group"
          title={`${team.name} — ${t('team.chat')}`}
        >
          <MessageCircle size={24} className="text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-cyber-bg" />
        </button>
      </div>
    );
  }

  // Expanded: mini-chat window
  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 sm:w-96 flex flex-col
      bg-cyber-darker/95 backdrop-blur-md border border-cyber-border rounded-2xl
      shadow-2xl shadow-black/50 overflow-hidden animate-fade-in"
      style={{ maxHeight: 'min(500px, calc(100vh - 6rem))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyber-border
        bg-gradient-to-r from-cyber-cyan/10 to-cyber-purple/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle size={18} className="text-cyber-cyan shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{team.name}</h3>
            <p className="text-[10px] text-gray-500">{memberCount} {t('team.members').toLowerCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(false)}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title={t('chat.minimize')}
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
            title={t('chat.disable_mini')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
        style={{ maxHeight: 'min(350px, calc(100vh - 14rem))' }}
      >
        {messages.length === 0 && (
          <div className="text-center py-6">
            <MessageCircle size={32} className="mx-auto text-gray-600 mb-2" />
            <p className="text-xs text-gray-500">{t('chat.no_messages')}</p>
          </div>
        )}
        {messages.map((msg: any) => {
          const isMe = msg.user_id === profile?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl ${
                  isMe
                    ? 'bg-cyber-cyan/20 border border-cyber-cyan/30 text-gray-200'
                    : 'bg-white/5 border border-cyber-border text-gray-300'
                }`}
              >
                {!isMe && (
                  <p className="text-[10px] text-cyber-purple font-semibold mb-0.5">
                    {msg.profiles?.display_name}
                  </p>
                )}
                <p className="text-xs break-words leading-relaxed">{msg.message}</p>
                <p className="text-[9px] text-gray-500 mt-0.5 text-right">
                  {new Date(msg.sent_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-cyber-border shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={t('team.send_message')}
            className="cyber-input flex-1 py-1.5 text-xs"
          />
          <button
            onClick={sendMessage}
            className="cyber-btn-primary px-3 py-1.5"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
