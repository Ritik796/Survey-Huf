import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { checkForUpdates } from '../Services/otaService';
import { createOtaUpdateHandlers } from '../Actions/Ota/OtaActions';
import UpdateModal from './UpdateModal/UpdateModal';

const OtaContext = createContext({ triggerOtaCheck: () => {} });
export const useOta = () => useContext(OtaContext);

const INITIAL_MODAL = {
  visible: false,
  title: 'New Update Available',
  actionLabel: 'Update Now',
  updateType: 'js',
  progress: 0,
  status: '',
  version: '',
  description: '',
  isDownloading: false,
  canStartUpdate: false,
  showUnavailableMessage: false,
  unavailableMessage: '',
  isMandatoryBlock: false,
  blockApp: false,
  hideActions: false,
  hideFooterNote: false,
  nonDismissible: true,
};

const CHECK_COOLDOWN_MS = 30000;

export const OtaProvider = ({ children }) => {
  const [otaModal, setOtaModal] = useState(INITIAL_MODAL);
  const pendingUpdateActionRef = useRef(null);
  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef(0);

  const otaHandlers = useMemo(
    () => createOtaUpdateHandlers({ setOtaModal, pendingUpdateActionRef }),
    [],
  );

  const triggerOtaCheck = useCallback(async () => {
    if (isCheckingRef.current) return;
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_COOLDOWN_MS) return;

    isCheckingRef.current = true;
    lastCheckRef.current = now;
    try {
      await checkForUpdates(otaHandlers, null, { forceRefreshDb: true, skipNativeExit: false });
    } finally {
      isCheckingRef.current = false;
    }
  }, [otaHandlers]);

  const onUpdatePress = useCallback(() => {
    const startUpdate = pendingUpdateActionRef.current;
    if (!startUpdate) return;
    if (otaModal.updateType === 'native') {
      setOtaModal((prev) => ({
        ...prev,
        canStartUpdate: false,
        status: 'Closing app...',
        showUnavailableMessage: false,
        unavailableMessage: '',
      }));
      pendingUpdateActionRef.current = null;
      startUpdate();
      return;
    }
    setOtaModal((prev) => ({
      ...prev,
      isDownloading: true,
      canStartUpdate: false,
      status: 'Downloading update...',
      showUnavailableMessage: false,
      unavailableMessage: '',
    }));
    pendingUpdateActionRef.current = null;
    startUpdate();
  }, [otaModal.updateType]);

  // Check on app start and when app comes to foreground from background
  useEffect(() => {
    triggerOtaCheck();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        triggerOtaCheck();
      }
    });

    return () => subscription.remove();
  }, [triggerOtaCheck]);

  const value = useMemo(() => ({ triggerOtaCheck }), [triggerOtaCheck]);

  return (
    <OtaContext.Provider value={value}>
      {children}
      <UpdateModal
        visible={otaModal.visible}
        title={otaModal.title}
        progress={otaModal.progress}
        status={otaModal.status}
        version={otaModal.version}
        description={otaModal.description}
        actionLabel={otaModal.actionLabel}
        onUpdatePress={onUpdatePress}
        isDownloading={otaModal.isDownloading}
        canStartUpdate={otaModal.canStartUpdate}
        showUnavailableMessage={otaModal.showUnavailableMessage}
        unavailableMessage={otaModal.unavailableMessage}
        hideActions={otaModal.hideActions}
        hideFooterNote={otaModal.hideFooterNote}
        nonDismissible={otaModal.nonDismissible}
      />
    </OtaContext.Provider>
  );
};
