"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { ApiError, apiFetch } from "./api";
import { useAuth } from "./auth";
import type {
  ChatMessage,
  KnowledgeFile,
  KnowledgeList,
  Me,
  Thread,
  ThreadsPage,
  ThreadsSummary,
  ThreadStatusFilter,
} from "./types";

/** Lists refresh every 10 s and an open conversation every 5 s; at this volume polling is enough. */
export const LIST_POLL_MS = 10_000;
export const THREAD_POLL_MS = 5_000;

export function useApi() {
  const { getToken, signOut } = useAuth();
  return useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      if (!token) {
        await signOut();
        throw new ApiError(401, "Tu sesión terminó. Volvé a entrar.");
      }
      try {
        return await apiFetch<T>(path, token, init);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await signOut();
        throw error;
      }
    },
    [getToken, signOut],
  );
}

export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/internal/me"), staleTime: 5 * 60_000 });
}

export function useThreadsSummary() {
  const api = useApi();
  return useQuery({
    queryKey: ["threads", "summary"],
    queryFn: () => api<ThreadsSummary>("/internal/threads/summary"),
    refetchInterval: LIST_POLL_MS,
  });
}

export function useThreads(status: ThreadStatusFilter, search: string) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["threads", "list", status, search],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status, limit: "50" });
      if (search) params.set("search", search);
      if (pageParam) params.set("cursor", pageParam);
      return api<ThreadsPage>(`/internal/threads?${params}`);
    },
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: LIST_POLL_MS,
  });
}

export function useThread(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["threads", "detail", id],
    queryFn: () => api<{ thread: Thread; messages: ChatMessage[] }>(`/internal/threads/${id}`),
    refetchInterval: THREAD_POLL_MS,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

export type ThreadAction = "pause" | "resume" | "clear-needs-human" | "crm-sync";

export function useThreadAction(id: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: ThreadAction) => api<{ thread: Thread }>(`/internal/threads/${id}/${action}`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["threads"] }),
  });
}

export function useDeleteThread() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/internal/threads/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: ["threads", "detail", id] });
      return client.invalidateQueries({ queryKey: ["threads"] });
    },
  });
}

export function useKnowledgeFiles() {
  const api = useApi();
  return useQuery({ queryKey: ["knowledge"], queryFn: () => api<KnowledgeList>("/internal/knowledge/files") });
}

export function useKnowledgeFileText(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["knowledge", "file", id],
    enabled: id !== null,
    queryFn: () => api<{ file: KnowledgeFile & { text: string } }>(`/internal/knowledge/files/${id}`),
  });
}

type UploadResult = { file: KnowledgeFile; replaced: boolean };

export function useUploadKnowledgeFile() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, replaceId }: { file: File; replaceId?: string }) => {
      const body = new FormData();
      body.append("file", file);
      return replaceId
        ? api<UploadResult>(`/internal/knowledge/files/${replaceId}`, { method: "PUT", body })
        : api<UploadResult>("/internal/knowledge/files", { method: "POST", body });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["knowledge"] }),
  });
}

export function useDeleteKnowledgeFile() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/internal/knowledge/files/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["knowledge"] }),
  });
}
