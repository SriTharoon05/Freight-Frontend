import type { ApiError } from './types';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function toApiError(error: unknown): ApiError {
  const source = record(error);
  // Interceptors already normalize errors; pages may call this helper again.
  if (typeof source.status === 'number' && typeof source.message === 'string') {
    return source as unknown as ApiError;
  }

  const response = record(source.response);
  if (typeof response.status === 'number') {
    const data = record(response.data);
    const fieldErrors: Record<string, string[]> = Object.create(null);
    const validation = Array.isArray(data.detail) ? data.detail.map(record) : [];
    for (const item of validation) {
      const loc = Array.isArray(item.loc) ? item.loc : [];
      const field = loc.slice(1).map(String).join('.') || 'Input';
      if (typeof item.msg === 'string') {
        (fieldErrors[field] ??= []).push(item.msg);
      }
    }
    const validationMessage = Object.entries(fieldErrors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`).join('; ');
    const message = typeof data.detail === 'string' ? data.detail
      : typeof data.message === 'string' ? data.message
      : validationMessage || (response.status >= 500
        ? 'Your workspace is temporarily unavailable. Please try again.'
        : 'The request could not be completed. Please try again.');
    return {
      status: response.status,
      message,
      detail: data,
      ...(validation.length ? { fieldErrors } : {}),
    };
  }
  if (source.code === 'ECONNABORTED' || source.code === 'ETIMEDOUT') {
    return { status: 0, message: 'The request timed out. Your workspace may still be starting; please try again.' };
  }
  if (source.request) {
    return { status: 0, message: 'Could not connect to your workspace. Please check your connection and try again.' };
  }
  return { status: -1, message: typeof source.message === 'string' ? source.message : 'An unexpected error occurred. Please try again.' };
}
