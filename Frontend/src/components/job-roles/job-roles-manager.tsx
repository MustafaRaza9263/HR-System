"use client";

import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CirclePlus,
  Pencil,
  Power,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query/query-keys";

import { IconPicker } from "./icon-picker";

type Status = "active" | "inactive";

interface Department {
  id: string;
  name: string;
  icon: string;
  status: Status;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  roleCount: number;
}

interface Role {
  id: string;
  name: string;
  departmentId: string;
  icon: string;
  status: Status;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

type EditorState =
  | { kind: "department"; item?: Department }
  | { kind: "role"; departmentId: string; item?: Role }
  | null;

type StatusConfirmation =
  | { kind: "department"; item: Department }
  | { kind: "role"; item: Role }
  | null;

interface JobRolesData {
  departments: Department[];
  roles: Role[];
}

interface DepartmentResponse {
  data: { departments: Department[] };
}

interface RoleResponse {
  data: { roles: Role[] };
}

interface DepartmentMutationResponse {
  data: { department: Department };
}

interface RoleMutationResponse {
  data: { role: Role };
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    const fieldMessage = error.fields ? Object.values(error.fields).flat().find(Boolean) : undefined;
    return fieldMessage ?? error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

async function fetchJobRoles(): Promise<JobRolesData> {
  const [departmentResult, roleResult] = await Promise.all([
    apiRequest<DepartmentResponse>("/departments"),
    apiRequest<RoleResponse>("/roles"),
  ]);
  return {
    departments: departmentResult.data.departments,
    roles: roleResult.data.roles,
  };
}

const emptyDepartments: Department[] = [];
const emptyRoles: Role[] = [];

export function JobRolesManager() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [confirmation, setConfirmation] = useState<StatusConfirmation>(null);
  const dataQuery = useQuery({
    queryKey: queryKeys.jobRoles.list,
    queryFn: fetchJobRoles,
  });
  const departments = dataQuery.data?.departments ?? emptyDepartments;
  const roles = dataQuery.data?.roles ?? emptyRoles;

  const statusMutation = useMutation({
    mutationFn: async (target: Exclude<StatusConfirmation, null>) => {
      const nextStatus: Status = target.item.status === "active" ? "inactive" : "active";
      if (target.kind === "department") {
        const result = await apiRequest<DepartmentMutationResponse>(`/departments/${target.item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        return { kind: target.kind, item: result.data.department } as const;
      }
      const result = await apiRequest<RoleMutationResponse>(`/roles/${target.item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      return { kind: target.kind, item: result.data.role } as const;
    },
    onSuccess: (result) => {
      queryClient.setQueryData<JobRolesData>(queryKeys.jobRoles.list, (current) => {
        if (!current) return current;
        if (result.kind === "department") {
          return { ...current, departments: current.departments.map((item) => item.id === result.item.id ? result.item : item) };
        }
        return { ...current, roles: current.roles.map((item) => item.id === result.item.id ? result.item : item) };
      });
      setConfirmation(null);
      alerts.success(`${result.item.name} is now ${result.item.status}.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobRoles.all });
    },
    onError: (error) => {
      alerts.error(errorMessage(error, "Status could not be updated."));
    },
  });
  const statusTarget = statusMutationTargetId(statusMutation.isPending, statusMutation.variables);

  const rolesByDepartment = useMemo(() => {
    const grouped = new Map<string, Role[]>();
    roles.forEach((role) => grouped.set(role.departmentId, [...(grouped.get(role.departmentId) ?? []), role]));
    return grouped;
  }, [roles]);

  const filteredDepartments = useMemo(() => {
    const cleanQuery = query.trim().toLocaleLowerCase();
    if (!cleanQuery) return departments;
    return departments.filter((department) => {
      if (department.name.toLocaleLowerCase().includes(cleanQuery)) return true;
      return (rolesByDepartment.get(department.id) ?? []).some((role) => role.name.toLocaleLowerCase().includes(cleanQuery));
    });
  }, [departments, query, rolesByDepartment]);

  function visibleRoles(departmentId: string) {
    const departmentRoles = rolesByDepartment.get(departmentId) ?? [];
    const cleanQuery = query.trim().toLocaleLowerCase();
    if (!cleanQuery) return departmentRoles;
    const departmentMatches = departments.find((item) => item.id === departmentId)?.name.toLocaleLowerCase().includes(cleanQuery);
    return departmentMatches ? departmentRoles : departmentRoles.filter((role) => role.name.toLocaleLowerCase().includes(cleanQuery));
  }

  function toggleExpanded(departmentId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  }

  function handleDepartmentSaved(department: Department, created: boolean) {
    queryClient.setQueryData<JobRolesData>(queryKeys.jobRoles.list, (current) => {
      if (!current) return { departments: [department], roles: [] };
      return {
        ...current,
        departments: created ? [...current.departments, department] : current.departments.map((item) => item.id === department.id ? department : item),
      };
    });
    if (created) setExpanded((current) => new Set(current).add(department.id));
    setEditor(null);
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobRoles.all });
  }

  function handleRoleSaved(role: Role, created: boolean) {
    if (created) {
      queryClient.setQueryData<JobRolesData>(queryKeys.jobRoles.list, (current) => current ? {
        departments: current.departments.map((item) => item.id === role.departmentId ? { ...item, roleCount: item.roleCount + 1 } : item),
        roles: [...current.roles, role],
      } : { departments: [], roles: [role] });
      setExpanded((current) => new Set(current).add(role.departmentId));
    } else {
      const previous = roles.find((item) => item.id === role.id);
      queryClient.setQueryData<JobRolesData>(queryKeys.jobRoles.list, (current) => current ? {
        roles: current.roles.map((item) => item.id === role.id ? role : item),
        departments: current.departments.map((item) => {
          if (!previous || previous.departmentId === role.departmentId) return item;
          if (item.id === previous.departmentId) return { ...item, roleCount: Math.max(0, item.roleCount - 1) };
          if (item.id === role.departmentId) return { ...item, roleCount: item.roleCount + 1 };
          return item;
        }),
      } : current);
    }
    setEditor(null);
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobRoles.all });
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="w-full space-y-6">
        <section aria-label="Job role metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Building2} label="Total Departments" supporting="Organization categories" value={departments.length} />
          <MetricCard icon={BriefcaseBusiness} label="Total Roles" supporting="Reusable job titles" value={roles.length} />
          <MetricCard icon={CirclePlus} label="Open Roles" supporting="Available when jobs are connected" value="—" />
          <MetricCard icon={Power} label="Closed Roles" supporting="Available when jobs are connected" value="—" />
        </section>

        <section aria-labelledby="department-list-title">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search job roles</span>
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search departments and job roles..."
                value={query}
              />
            </label>
            <button
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              onClick={() => setEditor({ kind: "department" })}
              type="button"
            >
              <CirclePlus aria-hidden className="h-4 w-4" />
              Create department
            </button>
          </div>

          <h2 className="sr-only" id="department-list-title">Departments and roles</h2>
          <div className="mt-5 space-y-4">
            {dataQuery.isPending ? <LoadingState /> : null}
            {dataQuery.isError ? <LoadError onRetry={() => void dataQuery.refetch()} /> : null}
            {dataQuery.isSuccess && filteredDepartments.length === 0 ? (
              <EmptyState hasQuery={Boolean(query.trim())} onCreate={() => setEditor({ kind: "department" })} />
            ) : null}
            {dataQuery.isSuccess ? filteredDepartments.map((department) => {
              const departmentRoles = visibleRoles(department.id);
              const isExpanded = query.trim() ? true : expanded.has(department.id);
              return (
                <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-gray-800/70 ${department.status === "active" ? "border-gray-200 dark:border-gray-700" : "border-gray-200 opacity-70 dark:border-gray-700"}`} key={department.id}>
                  <div className="flex min-h-20 items-center gap-3 px-4 py-4 sm:px-6">
                    <button
                      aria-expanded={isExpanded}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => toggleExpanded(department.id)}
                      type="button"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        <AppIcon className="h-5 w-5" fallback="building-2" name={department.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-base font-bold text-gray-950 dark:text-white">{department.name}</span>
                          {department.status === "inactive" ? <StatusBadge /> : null}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                          Updated {formatDistanceToNow(new Date(department.updatedAt), { addSuffix: true })}
                        </span>
                      </span>
                    </button>
                    <span className="hidden shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 sm:inline dark:bg-gray-800 dark:text-gray-300">
                      {department.roleCount} {department.roleCount === 1 ? "role" : "roles"}
                    </span>
                    <button className="icon-button" aria-label={`Edit ${department.name}`} onClick={() => setEditor({ kind: "department", item: department })} type="button">
                      <Pencil aria-hidden className="h-4 w-4" />
                    </button>
                    <button className="icon-button" aria-label={`${department.status === "active" ? "Deactivate" : "Activate"} ${department.name}`} disabled={statusTarget === department.id} onClick={() => setConfirmation({ kind: "department", item: department })} type="button">
                      <Power aria-hidden className="h-4 w-4" />
                    </button>
                    <button aria-label={`${isExpanded ? "Collapse" : "Expand"} ${department.name}`} className="icon-button" onClick={() => toggleExpanded(department.id)} type="button">
                      <ChevronDown aria-hidden className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-gray-800">
                      <div className="space-y-2">
                        {departmentRoles.map((role) => {
                          return (
                            <div className={`flex min-h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 py-2.5 dark:bg-gray-900/70 ${role.status === "inactive" ? "opacity-60" : ""}`} key={role.id}>
                              <AppIcon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" fallback="briefcase-business" name={role.icon} />
                              <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 dark:text-white">{role.name}</span>
                              {role.status === "inactive" ? <StatusBadge /> : null}
                              <button className="icon-button" aria-label={`Edit ${role.name}`} onClick={() => setEditor({ kind: "role", departmentId: role.departmentId, item: role })} type="button">
                                <Pencil aria-hidden className="h-4 w-4" />
                              </button>
                              <button className="icon-button" aria-label={`${role.status === "active" ? "Deactivate" : "Activate"} ${role.name}`} disabled={statusTarget === role.id} onClick={() => setConfirmation({ kind: "role", item: role })} type="button">
                                <Power aria-hidden className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                        {departmentRoles.length === 0 ? (
                          <p className="rounded-xl bg-gray-50 px-4 py-5 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                            {query.trim() ? "No matching roles in this department." : "No roles have been added yet."}
                          </p>
                        ) : null}
                      </div>
                      {department.status === "active" ? (
                        <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-indigo-300 px-4 text-sm font-bold text-indigo-600 transition hover:border-indigo-500 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10" onClick={() => setEditor({ kind: "role", departmentId: department.id })} type="button">
                          <CirclePlus aria-hidden className="h-4 w-4" />
                          Add role
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            }) : null}
          </div>
        </section>
      </div>

      {editor ? (
        <EntityEditor
          departments={departments}
          editor={editor}
          onClose={() => setEditor(null)}
          onDepartmentSaved={handleDepartmentSaved}
          onRoleSaved={handleRoleSaved}
        />
      ) : null}
      {confirmation ? (
        <StatusConfirmationModal
          pending={statusMutation.isPending}
          target={confirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => statusMutation.mutate(confirmation)}
        />
      ) : null}
    </div>
  );
}

function statusMutationTargetId(pending: boolean, target: StatusConfirmation | undefined) {
  return pending ? target?.item.id ?? null : null;
}

function StatusBadge() {
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Inactive</span>;
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-label="Loading job roles" role="status">
      {[1, 2].map((item) => <div className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/70" key={item} />)}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white px-6 py-12 text-center dark:border-red-500/20 dark:bg-gray-800/70">
      <AlertTriangle aria-hidden className="mx-auto h-8 w-8 text-red-500" />
      <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">Job roles could not be loaded</h3>
      <button className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400" onClick={onRetry} type="button">Try again</button>
    </div>
  );
}

interface StatusConfirmationModalProps {
  target: Exclude<StatusConfirmation, null>;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function StatusConfirmationModal({ target, pending, onCancel, onConfirm }: StatusConfirmationModalProps) {
  const activating = target.item.status === "inactive";
  const action = activating ? "Activate" : "Deactivate";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }} role="presentation">
      <section aria-labelledby="status-confirmation-title" aria-modal="true" className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900" role="dialog">
        <div className="p-6">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${activating ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"}`}>
            <Power aria-hidden className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-gray-950 dark:text-white" id="status-confirmation-title">{action} {target.kind}?</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {activating
              ? `${target.item.name} will become available for active workflows.`
              : `${target.item.name} will be hidden from new selections while historical records remain unchanged.`}
          </p>
        </div>
        <footer className="grid grid-cols-2 gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/70">
          <button className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" disabled={pending} onClick={onCancel} type="button">Cancel</button>
          <button className={`h-11 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 ${activating ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`} disabled={pending} onClick={onConfirm} type="button">{pending ? "Updating..." : action}</button>
        </footer>
      </section>
    </div>
  );
}

function EmptyState({ hasQuery, onCreate }: { hasQuery: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800/70">
      <Building2 aria-hidden className="mx-auto h-9 w-9 text-gray-400" />
      <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">{hasQuery ? "No job roles found" : "Create your first department"}</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hasQuery ? "Try another department or role name." : "Departments keep your reusable job roles organized."}</p>
      {!hasQuery ? <button className="mt-4 text-sm font-bold text-indigo-600 dark:text-indigo-400" onClick={onCreate} type="button">Create department</button> : null}
    </div>
  );
}

interface EntityEditorProps {
  editor: Exclude<EditorState, null>;
  departments: Department[];
  onClose: () => void;
  onDepartmentSaved: (department: Department, created: boolean) => void;
  onRoleSaved: (role: Role, created: boolean) => void;
}

function EntityEditor({ editor, departments, onClose, onDepartmentSaved, onRoleSaved }: EntityEditorProps) {
  const editing = Boolean(editor.item);
  const isDepartment = editor.kind === "department";
  const [name, setName] = useState(editor.item?.name ?? "");
  const [icon, setIcon] = useState(editor.item?.icon ?? (isDepartment ? "building-2" : "briefcase-business"));
  const [departmentId, setDepartmentId] = useState(editor.kind === "role" ? editor.departmentId : "");
  const activeDepartments = departments.filter((department) => department.status === "active" || department.id === departmentId);

  const saveMutation = useMutation({
    mutationFn: async (values: { name: string; icon: string; departmentId: string }) => {
      if (editor.kind === "department") {
        const result = await apiRequest<DepartmentMutationResponse>(editing ? `/departments/${editor.item!.id}` : "/departments", {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({ name: values.name, icon: values.icon }),
        });
        return { kind: "department", item: result.data.department } as const;
      }
      const result = await apiRequest<RoleMutationResponse>(editing ? `/roles/${editor.item!.id}` : "/roles", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(values),
      });
      return { kind: "role", item: result.data.role } as const;
    },
    onSuccess: (result) => {
      if (result.kind === "department") onDepartmentSaved(result.item, !editing);
      else onRoleSaved(result.item, !editing);
      alerts.success(`${result.kind === "department" ? "Department" : "Role"} ${editing ? "updated" : "created"} successfully.`);
    },
    onError: (error) => {
      alerts.error(errorMessage(error, `${isDepartment ? "Department" : "Role"} could not be saved.`));
    },
  });
  const saving = saveMutation.isPending;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, saving]);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (!cleanName) {
      alerts.error("Enter a name.");
      return;
    }
    if (!isDepartment && !departmentId) {
      alerts.error("Select a department for this role.");
      return;
    }

    saveMutation.mutate({ name: cleanName, icon, departmentId });
  }

  const title = `${editing ? "Edit" : "Create"} ${isDepartment ? "department" : "role"}`;

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/55 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form aria-label={title} className="flex h-[620px] max-h-[calc(100svh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900" onSubmit={save}>
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-5 sm:px-6 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-950 dark:text-white">{title}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{isDepartment ? "Organize related job roles under one category." : "Add a reusable title to a department."}</p>
          </div>
          <button aria-label="Close modal" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200">Name <span className="text-red-500">*</span></span>
            <input autoFocus className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400" maxLength={100} onChange={(event) => setName(event.target.value)} placeholder={isDepartment ? "e.g. Engineering" : "e.g. Senior Developer"} value={name} />
          </label>

          {!isDepartment ? (
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200">Department <span className="text-red-500">*</span></span>
              <select className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white" onChange={(event) => setDepartmentId(event.target.value)} required value={departmentId}>
                <option value="">Select a department</option>
                {activeDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}{department.status === "inactive" ? " (inactive)" : ""}</option>)}
              </select>
            </label>
          ) : null}

          <IconPicker label={`${isDepartment ? "Department" : "Role"} icon`} onChange={setIcon} value={icon} />
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-800/70">
          <button className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" disabled={saving} onClick={onClose} type="button">Cancel</button>
          <button className="h-11 rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Save"}</button>
        </footer>
      </form>
    </div>
  );
}
