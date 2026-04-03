import { getData, updateData } from '../../Firebase/dbServices';

// ─── Login — mirrors web app getSurveyorLogin() ───────────────────────────────
// userPin format: "SUR1", "HIS3", etc.
// Extracts numeric id → queries Firebase: Surveyors/{id}
export const getSurveyorLogin = async (userPin) => {
  try {
    // Extract numeric part — e.g. "HIS3" → "3", "SUR12" → "12"
    const numericMatch = userPin.match(/\d+/);
    if (!numericMatch) {
      return { status: 'error', message: 'Invalid User ID format.' };
    }
    const userId = numericMatch[0];

    const surveyor = await getData(`Surveyors/${userId}`);

    if (!surveyor) {
      return { status: 'error', message: 'User ID not found. Please check and try again.' };
    }

    // Account disabled (status === 1)
    if (surveyor.status === 1) {
      return { status: 'error', message: 'Your account has been disabled. Contact admin.' };
    }

    // Already logged in on another device
    if (surveyor.isLogin === 'yes') {
      return { status: 'error', message: 'Already logged in on another device.' };
    }

    // Mark as logged in
    await updateData(`Surveyors/${userId}`, { isLogin: 'yes' });

    return {
      status: 'success',
      data: { ...surveyor, userId, isLogin: 'yes' },
    };
  } catch (err) {
    return {
      status: 'error',
      message: err?.message ?? 'Something went wrong. Please try again.',
    };
  }
};

// ─── Logout — mark isLogin = "no" in Firebase ────────────────────────────────
export const setIsLogin = async (userId) => {
  try {
    await updateData(`Surveyors/${userId}`, { isLogin: 'no' });
    return { status: 'success' };
  } catch (err) {
    return { status: 'error', message: err?.message };
  }
};
