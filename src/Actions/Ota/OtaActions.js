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
        ? 'Naya app version available hai. Admin se naya APK install karwayein.'
        : 'Naya update available hai. Better performance ke liye abhi update karein.');

    pendingUpdateActionRef.current = typeof startUpdateFn === 'function' ? startUpdateFn : null;
    setOtaModal({
      visible: true,
      title: meta?.modalTitle || 'Naya Update Available',
      actionLabel: meta?.actionLabel || 'Abhi Update Karein',
      progress: 0,
      status: status || 'Update available...',
      version: String(version || '').replace(/^v/i, ''),
      description,
      isDownloading: false,
      canStartUpdate: !!startUpdateFn,
      showUnavailableMessage: !Boolean(startUpdateFn) && !hideActions,
      unavailableMessage: isMandatoryBlock
        ? 'Naya app version available hai. Admin se naya APK install karwayein.'
        : !startUpdateFn
          ? (status || 'Automatic update available nahi hai. Naya app build install karein.')
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
      status: 'Download ho raha hai...',
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
      status: type === 'native' ? 'Installer khul raha hai...' : 'Update install ho raha hai...',
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

