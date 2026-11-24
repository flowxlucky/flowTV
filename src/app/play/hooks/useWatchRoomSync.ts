'use client';

export function useWatchRoomSync(_options?: any) {
  return {
    isInRoom: false,
    isOwner: false,
    syncPaused: false,
    pauseSync: () => {},
    resumeSync: () => {},
    isSameVideoAsOwner: true,
    pendingOwnerChange: false,
    confirmFollowOwner: () => {},
    rejectFollowOwner: () => {},
    showSourceSwitchDialog: false,
    pendingOwnerState: null,
    handleConfirmSourceSwitch: () => {},
    handleCancelSourceSwitch: () => {},
  };
}
