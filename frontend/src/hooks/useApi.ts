import { useState, useCallback } from 'react';
import type { ApiError } from '../types';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | null> => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await fn();
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err: any) {
      const error: ApiError = err?.response?.data ?? {
        statusCode: 500,
        message: err?.message ?? 'Error inesperado',
      };
      setState({ data: null, loading: false, error });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), []);

  return { ...state, execute, reset };
}
