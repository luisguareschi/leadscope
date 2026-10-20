"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { ApiError, apiFetch } from "./api";
import { useAuth } from "./auth";
import { COMPANY_ID_HEADER, supportCompanyIdFor } from "./support";
import type {
  Assignee,
  AuthUserRemoval,
  KnowledgeFile,
  KnowledgeList,
  CompaniesList,
  CompanyConfig,
  CompanyListStatus,
  CompanySettings,
  CompanySummary,
  CreateCompanyInput,
  CreateCompanyResult,
  DeleteCompanyResult,
  Me,
  Operator,
  OperatorWrite,
  SettingsOptions,
  PromptPreview,
  SecretName,
  SecretStatus,
  SecretsList,
  SettingsSaveResult,
  SettingsVersion,
  Thread,
  ThreadDetail,
  ThreadFilters,
  ThreadsPage,
  ThreadsSummary,
  WhatsappConnectionCheck,
} from "./types";

/** Lists refresh every 10 s and an open conversation every 5 s; at this volume polling is enough. */
export const LIST_POLL_MS = 10_000;
export const THREAD_POLL_MS = 5_000;

const BLOCKED_CODES = new Set(["operator_archived", "company_archived"]);

export function useApi() {
  const { getToken, signOut, email } = useAuth();
  const client = useQueryClient();
  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      if (!token) {
        await signOut();
        throw new ApiError(401, "Tu sesión terminó. Volvé a entrar.");
      }
      const companyId = supportCompanyIdFor(email);
      try {
        return await apiFetch<T>(path, token, {
          ...init,
          headers: {
            ...(companyId ? { [COMPANY_ID_HEADER]: companyId } : {}),
            ...init?.headers,
          },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await signOut();
        // Archived while the panel was open: /me says so, and the layout replaces the page.
        if (
          error instanceof ApiError &&
          error.code &&
          BLOCKED_CODES.has(error.code) &&
          !path.startsWith("/internal/me")
        )
          void client.invalidateQueries({ queryKey: ["me"] });
        throw error;
      }
    },
    [getToken, signOut, email, client],
  );
}

export function useMe() {
  const api = useApi();
  const { email, status } = useAuth();
  return useQuery({
    queryKey: ["me", email],
    enabled: status === "signed_in" && Boolean(email),
    queryFn: () => api<Me>("/internal/me"),
    staleTime: 5 * 60_000,
    retry: (count, error) =>
      !(
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) && count < 3,
  });
}

export function useThreadsSummary(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: ["threads", "summary"],
    enabled,
    queryFn: () => api<ThreadsSummary>("/internal/threads/summary"),
    refetchInterval: LIST_POLL_MS,
  });
}

export function useThreads(filters: ThreadFilters) {
  const api = useApi();
  const { stage, bot, assignee, search } = filters;
  return useInfiniteQuery({
    queryKey: ["threads", "list", stage, bot, assignee, search],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ stage, bot, assignee, limit: "50" });
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
    queryFn: () => api<ThreadDetail>(`/internal/threads/${id}`),
    refetchInterval: THREAD_POLL_MS,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

export type ThreadAction =
  "pause" | "resume" | "clear-needs-human" | "crm-sync" | "take" | "contacted";

export function useThreadAction(id: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: ThreadAction) =>
      api<{ thread: Thread }>(`/internal/threads/${id}/${action}`, {
        method: "POST",
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["threads"] }),
  });
}

/** Active operators of the company, for "Asignar a…". */
export function useAssignees() {
  const api = useApi();
  return useQuery({
    queryKey: ["threads", "assignees"],
    queryFn: () =>
      api<{ assignees: Assignee[] }>("/internal/threads/assignees"),
    staleTime: 60_000,
  });
}

/** `operatorId` null leaves the thread with nobody. */
export function useAssignThread(id: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (operatorId: string | null) =>
      api<{ thread: Thread }>(`/internal/threads/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ operatorId }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["threads"] }),
  });
}

export function useDeleteThread() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/internal/threads/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: ["threads", "detail", id] });
      return client.invalidateQueries({ queryKey: ["threads"] });
    },
  });
}

export function useKnowledgeFiles() {
  const api = useApi();
  return useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api<KnowledgeList>("/internal/knowledge/files"),
  });
}

export function useKnowledgeFileText(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["knowledge", "file", id],
    enabled: id !== null,
    queryFn: () =>
      api<{ file: KnowledgeFile & { text: string } }>(
        `/internal/knowledge/files/${id}`,
      ),
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
        ? api<UploadResult>(`/internal/knowledge/files/${replaceId}`, {
            method: "PUT",
            body,
          })
        : api<UploadResult>("/internal/knowledge/files", {
            method: "POST",
            body,
          });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["knowledge"] }),
  });
}

export function useDeleteKnowledgeFile() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/internal/knowledge/files/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["knowledge"] }),
  });
}

export function useSecrets() {
  const api = useApi();
  return useQuery({
    queryKey: ["secrets"],
    queryFn: () => api<SecretsList>("/internal/secrets"),
  });
}

export function useSetSecret() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ name, value }: { name: SecretName; value: string }) =>
      api<{ secret: SecretStatus }>(`/internal/secrets/${name}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["secrets"] }),
  });
}

export function useCompanies(enabled: boolean, status: CompanyListStatus) {
  const api = useApi();
  return useQuery({
    queryKey: ["companies", "list", status],
    enabled,
    queryFn: () => api<CompaniesList>(`/internal/companies?status=${status}`),
  });
}

export function useCreateCompany() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompanyInput) =>
      api<CreateCompanyResult>("/internal/companies", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useCompanyAction() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      action,
    }: {
      companyId: string;
      action: "archive" | "restore";
    }) =>
      api<{ company: CompanySummary }>(
        `/internal/companies/${companyId}/${action}`,
        { method: "POST" },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useDeleteCompany() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      confirmSlug,
    }: {
      companyId: string;
      confirmSlug: string;
    }) =>
      api<DeleteCompanyResult>(`/internal/companies/${companyId}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmSlug }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useOperators(companyId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["companies", "operators", companyId],
    queryFn: () =>
      api<{ operators: Operator[] }>(
        `/internal/companies/${companyId}/operators`,
      ),
  });
}

/** Operator changes also refresh the company list, which shows each company's operators. */
function useOperatorMutation<TInput, TResult>(
  request: (api: ReturnType<typeof useApi>, input: TInput) => Promise<TResult>,
) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => request(api, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useAddOperator(companyId: string) {
  return useOperatorMutation((api, email: string) =>
    api<OperatorWrite>(`/internal/companies/${companyId}/operators`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  );
}

export function useResendInvite(companyId: string) {
  return useOperatorMutation((api, operatorId: string) =>
    api<OperatorWrite>(
      `/internal/companies/${companyId}/operators/${operatorId}/invite`,
      { method: "POST" },
    ),
  );
}

export function useOperatorArchive(companyId: string) {
  return useOperatorMutation(
    (api, input: { operatorId: string; action: "archive" | "restore" }) =>
      api<{ operator: Operator }>(
        `/internal/companies/${companyId}/operators/${input.operatorId}/${input.action}`,
        { method: "POST" },
      ),
  );
}

export function useDeleteOperator(companyId: string) {
  return useOperatorMutation((api, operatorId: string) =>
    api<{ authUser: AuthUserRemoval }>(
      `/internal/companies/${companyId}/operators/${operatorId}`,
      { method: "DELETE" },
    ),
  );
}

export function useSettingsOptions() {
  const api = useApi();
  return useQuery({
    queryKey: ["settings", "options"],
    queryFn: () => api<SettingsOptions>("/internal/settings/options"),
    staleTime: 10 * 60_000,
  });
}

export function useSettings() {
  const api = useApi();
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api<CompanySettings>("/internal/settings"),
  });
}

export function useSettingsVersions() {
  const api = useApi();
  return useQuery({
    queryKey: ["settings", "versions"],
    queryFn: () =>
      api<{ versions: SettingsVersion[] }>("/internal/settings/versions"),
  });
}

export function usePromptPreview() {
  const api = useApi();
  return useQuery({
    queryKey: ["settings", "prompt"],
    queryFn: () => api<PromptPreview>("/internal/settings/prompt"),
  });
}

/** Saving or restoring refreshes the settings, their versions, and the assembled prompt. */
function useSettingsMutation<T>(
  request: (
    api: ReturnType<typeof useApi>,
    input: T,
  ) => Promise<SettingsSaveResult>,
) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => request(api, input),
    onSuccess: (result) => {
      client.setQueryData(["settings"], result.settings);
      return client.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

/** Leaving `whatsappPhoneNumberId` out keeps the stored one; null clears it. */
export function useSaveConfig() {
  return useSettingsMutation(
    (
      api,
      input: { config: CompanyConfig; whatsappPhoneNumberId?: string | null },
    ) =>
      api<SettingsSaveResult>("/internal/settings/config", {
        method: "PUT",
        body: JSON.stringify({
          ...input.config,
          ...(input.whatsappPhoneNumberId !== undefined
            ? { whatsappPhoneNumberId: input.whatsappPhoneNumberId }
            : {}),
        }),
      }),
  );
}

export function useSaveInstructions() {
  return useSettingsMutation((api, instructions: string) =>
    api<SettingsSaveResult>("/internal/settings/instructions", {
      method: "PUT",
      body: JSON.stringify({ instructions }),
    }),
  );
}

export function useRestoreSettingsVersion() {
  return useSettingsMutation((api, versionId: string) =>
    api<SettingsSaveResult>(
      `/internal/settings/versions/${versionId}/restore`,
      {
        method: "POST",
      },
    ),
  );
}

export function useClearSecret() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: SecretName) =>
      api<{ secret: SecretStatus }>(`/internal/secrets/${name}`, {
        method: "DELETE",
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["secrets"] }),
  });
}

/** Asks Kapso about the company's number and webhook. Run on demand: Kapso rate-limits it. */
export function useWhatsappConnectionCheck() {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api<WhatsappConnectionCheck>("/internal/whatsapp/connection-check"),
  });
}
