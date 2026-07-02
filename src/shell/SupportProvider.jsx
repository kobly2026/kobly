import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/api/supabaseClient.js';
import { KoblyApi } from '@/api/mockApi.js';
import { resetDb, reshapeSupportMessage } from '@/api/supabaseDb.js';
import { useKobly } from '@/store/store.jsx';

// Kobly — SupportProvider: fonte única das conversas de suporte + Realtime.
// UM canal por sessão (sem filtro): a RLS/WALRUS avalia cada evento contra o JWT do
// assinante — Cliente recebe só as suas conversas; Suporte/Admin recebem todas.
// Tickets (console/histórico) e SupportWidget (FAB) consomem daqui via useSupport().

const SupportCtx = createContext(null);

function SupportProvider({ children }) {
  const store = useKobly();
  const isStaff = !!(store.can && store.can.answerTickets);
  const meId = store.session ? store.session.userId : null;
  const [convs, setConvs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      resetDb();
      const rows = await KoblyApi.listConversations();
      setConvs(rows || []);
      setLoaded(true);
    } catch (e) { /* mantém o estado atual; retry no próximo evento */ }
    refreshingRef.current = false;
  }, []);

  useEffect(() => { if (meId) refresh(); }, [meId, refresh]);

  // Canal Realtime único da sessão, com resync no SUBSCRIBED e retry em erro.
  useEffect(() => {
    if (!meId) return undefined;
    let ch = null; let stopped = false; let retryT = null;

    const onMessage = (row) => {
      resetDb();
      const msg = reshapeSupportMessage(row);
      setConvs((cur) => {
        const idx = cur.findIndex((c) => c.id === row.conversation_id);
        if (idx === -1) { refresh(); return cur; } // conversa ainda não carregada
        const conv = cur[idx];
        if (conv.mensagens.some((m) => m.id === msg.id)) return cur; // eco do append otimista
        const next = [...cur];
        next[idx] = { ...conv, mensagens: [...conv.mensagens, msg], updatedAtIso: msg.createdAt || conv.updatedAtIso, atualizadoEm: 'agora' };
        return next;
      });
    };

    const onConv = (p) => {
      resetDb();
      if (p.eventType === 'INSERT') { refresh(); return; }
      if (p.eventType === 'UPDATE' && p.new) {
        setConvs((cur) => cur.map((c) => (c.id === p.new.id ? {
          ...c,
          status: p.new.status_chamado,
          prioridade: p.new.prioridade_chamado,
          assignedTo: p.new.assigned_to || null,
          clienteLastReadAt: p.new.cliente_last_read_at || null,
          supportLastReadAt: p.new.support_last_read_at || null,
          updatedAtIso: p.new.updated_at || c.updatedAtIso,
        } : c)));
        return;
      }
      refresh();
    };

    const start = () => {
      if (stopped) return;
      ch = supabase.channel('support-rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (p) => onMessage(p.new))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, onConv)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') refresh(); // resync cobre mensagens perdidas offline
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !stopped) {
            try { supabase.removeChannel(ch); } catch (e) { /* noop */ }
            retryT = setTimeout(start, 3000);
          }
        });
    };
    start();
    return () => {
      stopped = true;
      clearTimeout(retryT);
      if (ch) { try { supabase.removeChannel(ch); } catch (e) { /* noop */ } }
    };
  }, [meId, refresh]);

  // Não-lidas por conversa: mensagens do OUTRO lado, depois do meu last_read.
  const unreadByConv = useMemo(() => {
    const map = {};
    convs.forEach((c) => {
      const lastRead = isStaff ? c.supportLastReadAt : c.clienteLastReadAt;
      map[c.id] = c.mensagens.filter((m) => (
        (isStaff ? m.autor === 'cliente' : m.autor === 'suporte')
        && m.profileId !== meId
        && (!lastRead || (m.createdAt && m.createdAt > lastRead))
      )).length;
    });
    return map;
  }, [convs, isStaff, meId]);
  const unreadTotal = useMemo(() => Object.values(unreadByConv).reduce((s, n) => s + n, 0), [unreadByConv]);

  const send = useCallback(async (convId, texto) => {
    const row = await KoblyApi.sendMessage(convId, texto);
    if (row) {
      const msg = reshapeSupportMessage(row);
      setConvs((cur) => cur.map((c) => (
        c.id === convId && !c.mensagens.some((m) => m.id === msg.id)
          ? { ...c, mensagens: [...c.mensagens, msg], updatedAtIso: msg.createdAt, atualizadoEm: 'agora' }
          : c
      )));
    }
    return !!row;
  }, []);

  const createConversation = useCallback(async (payload) => {
    const r = await KoblyApi.createConversation(payload);
    if (!r.error) await refresh();
    return r;
  }, [refresh]);

  const assign = useCallback(async (convId, profileId) => {
    const ok = await KoblyApi.assignConversation(convId, profileId);
    if (ok) refresh(); // resolve assignedToNome via hydrate
    return ok;
  }, [refresh]);

  const resolve = useCallback(async (convId) => {
    const ok = await KoblyApi.resolveConversation(convId);
    if (ok) setConvs((cur) => cur.map((c) => (c.id === convId ? { ...c, status: 'Resolvida' } : c)));
    return ok;
  }, []);

  const markRead = useCallback(async (convId) => {
    const nowIso = new Date().toISOString();
    const col = isStaff ? 'supportLastReadAt' : 'clienteLastReadAt';
    setConvs((cur) => cur.map((c) => (c.id === convId ? { ...c, [col]: nowIso } : c)));
    await KoblyApi.markConversationRead(convId);
  }, [isStaff]);

  const value = { convs, loaded, isStaff, unreadByConv, unreadTotal, refresh, send, createConversation, assign, resolve, markRead };
  return React.createElement(SupportCtx.Provider, { value }, children);
}

function useSupport() { return useContext(SupportCtx); }

export { SupportProvider, useSupport };
