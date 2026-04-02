import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_DETAILS_KEY = 'userDetails';

export const saveUserDetails = async (details) => {
  await AsyncStorage.setItem(USER_DETAILS_KEY, JSON.stringify(details));
};

export const getUserDetails = async () => {
  const raw = await AsyncStorage.getItem(USER_DETAILS_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const clearUserDetails = async () => {
  await AsyncStorage.removeItem(USER_DETAILS_KEY);
};

export const clearAll = async () => {
  await AsyncStorage.clear();
};
