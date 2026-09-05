import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGetLatestFeedHeadQuery } from '@/services/postApi';

interface UseNewPostsAvailableOptions {
  currentFirstPostId: string | null;
  currentTotalPosts: number;
  minPollIntervalMs?: number;
  maxPollIntervalMs?: number;
  atTopThresholdPx?: number;
  enabled?: boolean;
}

interface UseNewPostsAvailableResult {
  showBanner: boolean;
  newCount: number;
  latestHeadId: string | null;
  lastSeenHeadId: string | null;
  isAtTop: boolean;
  acknowledge: () => void;
  dismissBanner: () => void;
  markSeen: (headId: string) => void;
}

const scrollRoot = () =>
  typeof document !== 'undefined' ? (document.scrollingElement ?? document.body) : null;

const isAtTopOfFeed = (thresholdPx: number) => {
  const root = scrollRoot();
  if (!root) return true;
  return root.scrollTop <= thresholdPx;
};

const getJitter = (minMs: number, maxMs: number) => {
  if (maxMs <= minMs) return minMs;
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
};

export const useNewPostsAvailable = ({
  currentFirstPostId,
  currentTotalPosts,
  minPollIntervalMs = 30_000,
  maxPollIntervalMs = 45_000,
  atTopThresholdPx = 40,
  enabled = true,
}: UseNewPostsAvailableOptions): UseNewPostsAvailableResult => {
  const [lastSeenHeadId, setLastSeenHeadId] = useState<string | null>(
    currentFirstPostId ?? null,
  );
  const [dismissedHeadId, setDismissedHeadId] = useState<string | null>(null);
  const [atTop, setAtTop] = useState<boolean>(() => isAtTopOfFeed(atTopThresholdPx));

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);
  const snapshotRef = useRef<{
    followingTotal: number;
    discoverTotal: number;
  } | null>(null);

  const { data: headData, refetch: refetchHead } = useGetLatestFeedHeadQuery(undefined, {
    skip: !enabled,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: false,
    refetchOnReconnect: true,
  });

  const latestHeadId = headData?.effectiveHeadId ?? null;
  const latestFollowingTotal = headData?.totalFollowingPosts ?? 0;
  const latestDiscoverTotal = headData?.totalDiscoverPosts ?? 0;
  const latestMergedTotal = latestFollowingTotal + latestDiscoverTotal;

  const headChanged = !!latestHeadId && latestHeadId !== lastSeenHeadId;

  const newCount = useMemo(() => {
    if (!snapshotRef.current) return 0;
    const delta = latestMergedTotal - (snapshotRef.current.followingTotal + snapshotRef.current.discoverTotal);
    return delta > 0 ? delta : headChanged ? 1 : 0;
  }, [
    latestMergedTotal,
    headChanged,
  ]);

  const showBanner = enabled && !atTop && headChanged && dismissedHeadId !== latestHeadId;

  const dismissBanner = useCallback(() => {
    if (latestHeadId) setDismissedHeadId(latestHeadId);
  }, [latestHeadId]);

  const markSeen = useCallback((headId: string) => {
    setLastSeenHeadId(headId);
    setDismissedHeadId(null);
    snapshotRef.current = {
      followingTotal: latestFollowingTotal,
      discoverTotal: latestDiscoverTotal,
    };
  }, [latestFollowingTotal, latestDiscoverTotal]);

  useEffect(() => {
    if (!currentFirstPostId || lastSeenHeadId) return;
    markSeen(currentFirstPostId);
  }, [currentFirstPostId, lastSeenHeadId, markSeen]);

  useEffect(() => {
    if (!enabled) return;
    if (!snapshotRef.current && headData) {
      snapshotRef.current = {
        followingTotal: headData.totalFollowingPosts,
        discoverTotal: headData.totalDiscoverPosts,
      };
    }
  }, [headData, enabled]);

  const acknowledge = useCallback(() => {
    if (latestHeadId) markSeen(latestHeadId);
  }, [latestHeadId, markSeen]);

  useEffect(() => {
    if (!enabled) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const top = isAtTopOfFeed(atTopThresholdPx);
        setAtTop(top);
        ticking = false;
      });
    };
    const target = scrollRoot();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    target?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      target?.removeEventListener('scroll', onScroll);
    };
  }, [enabled, atTopThresholdPx]);

  useEffect(() => {
    if (!enabled || !atTop || !headChanged || !latestHeadId) return;
    markSeen(latestHeadId);
  }, [atTop, headChanged, latestHeadId, markSeen, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (pollingRef.current) return;
    pollingRef.current = true;

    const run = async () => {
      try {
        await refetchHead();
      } finally {
        const delay = getJitter(minPollIntervalMs, maxPollIntervalMs);
        pollTimerRef.current = setTimeout(run, delay);
      }
    };

    const delay = getJitter(minPollIntervalMs, maxPollIntervalMs);
    pollTimerRef.current = setTimeout(run, delay);

    return () => {
      pollingRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, minPollIntervalMs, maxPollIntervalMs, refetchHead]);

  return {
    showBanner,
    newCount,
    latestHeadId,
    lastSeenHeadId,
    isAtTop: atTop,
    acknowledge,
    dismissBanner,
    markSeen,
  };
};

export default useNewPostsAvailable;
