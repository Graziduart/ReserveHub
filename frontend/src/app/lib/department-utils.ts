import type { Departamento } from '../data/types';

/** Normaliza nome para comparação (trim + minúsculas). */
export function normalizeDepartmentName(name: string): string {
  return name.trim();
}

export function departmentNamesMatch(a: string, b: string): boolean {
  return normalizeDepartmentName(a).toLocaleLowerCase('pt-PT') ===
    normalizeDepartmentName(b).toLocaleLowerCase('pt-PT');
}

/** Verifica se já existe departamento com o mesmo nome (ignora o registo em edição). */
export function isDepartmentNameTaken(
  name: string,
  departamentos: Pick<Departamento, 'id' | 'nome'>[],
  editingId?: string,
): boolean {
  const normalized = normalizeDepartmentName(name);
  if (!normalized) return false;
  return departamentos.some(
    (d) =>
      d.id !== editingId &&
      departmentNamesMatch(d.nome, normalized),
  );
}

/** Departamento obrigatório: ID válido e nome preenchido (não "—"). */
export function hasValidDepartment(usuario: Pick<Usuario, 'departmentId' | 'departamento'>): boolean {
  const nome = usuario.departamento?.trim();
  return Boolean(usuario.departmentId?.trim() && nome && nome !== '—');
}
