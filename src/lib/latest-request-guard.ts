export type LatestRequestGuard = {
  begin(): number;
  isCurrent(requestId: number): boolean;
  invalidate(): void;
};

/**
 * Prevent stale async requests from committing state after a newer request
 * starts or the owning session is invalidated.
 */
export function createLatestRequestGuard(): LatestRequestGuard {
  let latestRequestId = 0;

  return {
    begin() {
      latestRequestId += 1;
      return latestRequestId;
    },
    isCurrent(requestId) {
      return requestId === latestRequestId;
    },
    invalidate() {
      latestRequestId += 1;
    },
  };
}
