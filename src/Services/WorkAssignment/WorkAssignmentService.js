import { getData, updateData } from '../../Firebase/dbServices';

// ─── Check Work Assignment ────────────────────────────────────────────────────
// Reads SurveyorsCuurentAssignment/{userId} — same path as web app
export const checkWorkAssignment = async (userId) => {
  try {
    const assignment = await getData(`SurveyorsCuurentAssignment/${userId}`);
    if (!assignment) {
      return { status: 'error', message: 'No work assigned yet. Contact your supervisor.' };
    }
    return { status: 'success', data: assignment };
  } catch (err) {
    return { status: 'error', message: err?.message ?? 'Error checking work assignment.' };
  }
};

// ─── Update isLogin to "no" ───────────────────────────────────────────────────
export const updateIsLogin = async (userId) => {
  try {
    await updateData(`Surveyors/${userId}`, { isLogin: 'no' });
    return { status: 'success' };
  } catch (err) {
    return { status: 'error', message: err?.message ?? 'Logout update failed.' };
  }
};
