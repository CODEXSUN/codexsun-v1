import { QueryClient } from "@tanstack/react-query";

export function createMobileQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 15, // 15 minutes
        staleTime: 1000 * 30, // 30 seconds
        retry: (failureCount, error) => {
          // Do not retry 401/403/404 or tenant isolation errors
          if (error && typeof error === "object" && "statusCode" in error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 401 || status === 403 || status === 404) return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: false
      }
    }
  });
}

export const queryClient = createMobileQueryClient();
