export const createOtaUpdateHandlers = ({ setOtaModal, pendingUpdateActionRef }) => ({
  onUpdateFound: (version, status, startUpdateFn, meta = {}) => {
    const updateType = meta?.updateType === 'native' ? 'native' : 'js';
    const isMandatoryBlock = Boolean(meta?.mandatoryBlock);
    const hideActions = typeof meta?.hideActions === 'boolean' ? meta.hideActions : isMandatoryBlock;
    const hideFooterNote = typeof meta?.hideFooterNote === 'boolean' ? meta.hideFooterNote : isMandatoryBlock;
    const nonDismissible = typeof meta?.nonDismissible === 'boolean' ? meta.nonDismissible : isMandatoryBlock;
    const description =
      meta?.description
      || (updateType === 'native'
        ? 'A new app version is available. Please contact admin to install the new APK.'
        : 'A new update is available. Update now for better performance.');

    pendingUpdateActionRef.current = typeof startUpdateFn === 'function' ? startUpdateFn : null;
    setOtaModal({
      visible: true,
      title: meta?.modalTitle || 'New Update Available',
      actionLabel: meta?.actionLabel || 'Update Now',
      updateType,
      progress: 0,
      status: status || 'Update available...',
      version: String(version || '').replace(/^v/i, ''),
      description,
      isDownloading: false,
      canStartUpdate: !!startUpdateFn,
      showUnavailableMessage: !Boolean(startUpdateFn) && !hideActions,
      unavailableMessage: isMandatoryBlock
        ? 'A new app version is available. Please contact admin to install the new APK.'
        : !startUpdateFn
          ? (status || 'Automatic update not available. Please install the new app build.')
          : '',
      isMandatoryBlock,
      blockApp: isMandatoryBlock,
      hideActions,
      hideFooterNote,
      nonDismissible,
      autoStartBlocked: isMandatoryBlock,
    });
  },
  onProgress: (progressValue) => {
    const safeProgress = Number.isFinite(progressValue) ? progressValue : 0;
    setOtaModal((prev) => ({
      ...prev,
      progress: safeProgress,
      isDownloading: true,
      status: 'Downloading...',
      showUnavailableMessage: false,
      unavailableMessage: '',
    }));
  },
  onComplete: (type) => {
    setOtaModal((prev) => ({
      ...prev,
      isDownloading: true,
      canStartUpdate: false,
      progress: 100,
      status: type === 'native' ? 'Opening installer...' : 'Installing update...',
      showUnavailableMessage: false,
      unavailableMessage: '',
    }));
  },
  onError: () => {
    setOtaModal((prev) => ({
      ...prev,
      visible: false,
      isDownloading: false,
      canStartUpdate: false,
      status: '',
      showUnavailableMessage: false,
      unavailableMessage: '',
      isMandatoryBlock: false,
      blockApp: false,
      hideActions: false,
      hideFooterNote: false,
      nonDismissible: true,
    }));
  },
});

