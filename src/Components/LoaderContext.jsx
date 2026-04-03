import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import CommonLoader from './CommonLoader';

const LoaderContext = createContext({
  showLoader: () => {},
  hideLoader: () => {},
});

export const useLoader = () => useContext(LoaderContext);

export const LoaderProvider = ({ children }) => {
  const [loader, setLoader] = useState({
    isLoading: false,
    text: 'Please wait...',
    smallArea: false,
  });

  const showLoader = useCallback((text = 'Please wait...', smallArea = false) => {
    setLoader({
      isLoading: true,
      text,
      smallArea,
    });
  }, []);

  const hideLoader = useCallback(() => {
    setLoader((prev) => ({ ...prev, isLoading: false }));
  }, []);

  const value = useMemo(() => ({ showLoader, hideLoader }), [showLoader, hideLoader]);

  return (
    <LoaderContext.Provider value={value}>
      {children}
      <CommonLoader
        isLoading={loader.isLoading}
        text={loader.text}
        smallArea={loader.smallArea}
      />
    </LoaderContext.Provider>
  );
};
