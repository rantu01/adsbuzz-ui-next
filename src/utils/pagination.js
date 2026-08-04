// Pure helpers for server-side list pagination.

export function getPagination(searchParams, defaults = { page: 1, limit: 50 }) {
  const rawPage = Number.parseInt(searchParams?.get?.("page") ?? "", 10);
  const rawLimit = Number.parseInt(searchParams?.get?.("limit") ?? "", 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : defaults.page;
  const limit = Math.min(
    200,
    Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaults.limit,
  );

  return { page, limit, skip: (page - 1) * limit };
}

export function paginate(items, { page, limit, skip } = {}) {
  const arr = Array.isArray(items) ? items : [];
  const total = arr.length;
  const pageSize = limit > 0 ? limit : arr.length || 1;
  const start = skip >= 0 ? skip : 0;

  return {
    data: arr.slice(start, start + pageSize),
    total,
    page: page || 1,
    limit: pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
